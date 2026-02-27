defmodule ChatForgeWeb.ChatChannel do
  @moduledoc """
  Phoenix Channel для AI-чата.
  Топик: chat:<conversation_id>

  Обрабатывает входящие сообщения от End User-а,
  вызывает AI с streaming и отправляет чанки клиенту.
  Каждое сообщение обрабатывается в отдельном Task (неблокирующий стриминг).
  """

  use Phoenix.Channel

  alias ChatForge.{Chat, AI}

  require Logger

  @doc """
  Подключение к каналу chat:<conversation_id>.
  Проверяет принадлежность диалога текущему End User-у и тенанту.
  """
  def join("chat:" <> conversation_id, _params, socket) do
    end_user = socket.assigns.current_user
    tenant_id = socket.assigns.tenant_id

    case Chat.get_conversation(conversation_id, end_user.id, tenant_id) do
      {:ok, conversation} ->
        socket =
          socket
          |> assign(:conversation_id, conversation_id)
          |> assign(:conversation, conversation)

        {:ok, socket}

      {:error, :not_found} ->
        {:error, %{reason: "unauthorized"}}
    end
  end

  @doc """
  Обработка входящего сообщения от клиента.
  Запускает Task.async для неблокирующего стриминга AI-ответа.
  """
  def handle_in("send_message", %{"content" => content}, socket) do
    end_user = socket.assigns.current_user
    tenant_id = socket.assigns.tenant_id
    conversation_id = socket.assigns.conversation_id

    # Проверяем лимит сообщений
    case Chat.check_limit(end_user.id, tenant_id) do
      {:error, :limit_reached} ->
        push(socket, "limit_reached", %{})
        {:noreply, socket}

      {:ok, :allowed} ->
        # Запускаем стриминг в отдельном процессе
        channel_pid = self()

        Task.start(fn ->
          run_ai_streaming(channel_pid, conversation_id, end_user.id, tenant_id, content)
        end)

        {:noreply, socket}
    end
  end

  # Обработка чанка от Task
  def handle_info({:ai_chunk, chunk}, socket) do
    push(socket, "message_chunk", %{content: chunk})
    {:noreply, socket}
  end

  # Обработка завершения стриминга от Task
  def handle_info({:ai_done, %{message_id: message_id, content: content}}, socket) do
    push(socket, "message_done", %{message_id: message_id, content: content})
    {:noreply, socket}
  end

  # Обработка ошибки AI от Task
  def handle_info({:ai_error, reason}, socket) do
    push(socket, "message_error", %{reason: reason})
    {:noreply, socket}
  end

  # Игнорируем PubSub-события, которые не предназначены для канала
  def handle_info({:message_sent, _payload}, socket) do
    {:noreply, socket}
  end

  # Catch-all для прочих неожиданных сообщений
  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  # -------------------------------------------------------------------------
  # Приватные функции
  # -------------------------------------------------------------------------

  # Выполняет полный цикл: сохранить сообщение → вызвать AI → сохранить ответ
  defp run_ai_streaming(channel_pid, conversation_id, end_user_id, tenant_id, content) do
    with {:ok, _user_message} <- Chat.send_message(conversation_id, end_user_id, content),
         {:ok, _end_user} <- Chat.increment_usage(end_user_id),
         {:ok, instance} <- get_instance_with_settings(tenant_id) do

      # Получаем историю сообщений для контекста AI
      %{messages: history} = Chat.get_messages(conversation_id, %{page: 1, per_page: 50})

      system_prompt = get_system_prompt(instance)
      ai_messages = AI.build_messages(system_prompt, history)

      # Callback для каждого чанка — отправляем в канал
      callback = fn chunk ->
        send(channel_pid, {:ai_chunk, chunk})
      end

      case AI.complete(tenant_id, conversation_id, ai_messages, callback) do
        {:ok, %{content: full_content, output_tokens: tokens}} ->
          case Chat.save_ai_response(conversation_id, full_content, tokens) do
            {:ok, message} ->
              send(channel_pid, {:ai_done, %{message_id: message.id, content: full_content}})

            {:error, reason} ->
              Logger.error("ChatChannel: ошибка сохранения ответа AI: #{inspect(reason)}")
              send(channel_pid, {:ai_error, "Ошибка сохранения ответа"})
          end

        {:error, %{message: msg}} ->
          send(channel_pid, {:ai_error, msg})

        {:error, :stream_interrupted} ->
          send(channel_pid, {:ai_error, "Соединение с AI прервано"})
      end
    else
      {:error, :not_found} ->
        send(channel_pid, {:ai_error, "Диалог не найден"})

      {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
        send(channel_pid, {:ai_error, "Ошибка сохранения сообщения"})

      error ->
        Logger.error("ChatChannel: неожиданная ошибка: #{inspect(error)}")
        send(channel_pid, {:ai_error, "Внутренняя ошибка"})
    end
  rescue
    e ->
      Logger.error("ChatChannel: исключение в Task: #{inspect(e)}")
      send(channel_pid, {:ai_error, "internal_error"})
  end

  # Получает инстанс с настройками для system_prompt
  defp get_instance_with_settings(tenant_id) do
    case ChatForge.Repo.get(ChatForge.Instances.ChatInstance, tenant_id) do
      nil -> {:error, :not_found}
      instance ->
        instance_with_settings = ChatForge.Repo.preload(instance, :instance_settings)
        {:ok, instance_with_settings}
    end
  end

  # Извлекает system_prompt из настроек инстанса
  defp get_system_prompt(%{instance_settings: %{system_prompt: prompt}})
       when is_binary(prompt) and prompt != "" do
    prompt
  end

  defp get_system_prompt(_), do: "Ты полезный AI-ассистент. Отвечай на русском языке."
end
