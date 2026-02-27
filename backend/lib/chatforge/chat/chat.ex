defmodule ChatForge.Chat do
  @moduledoc """
  Контекст Chat: диалоги, сообщения, конечные пользователи.

  Зона ответственности:
  - Регистрация и аутентификация End User-ов в чат-инстансе
  - Создание и ведение диалогов (conversations)
  - Хранение сообщений и подсчёт использованных токенов
  - Контроль лимитов сообщений для End User-ов

  Все данные изолированы по chat_instance_id (tenant_id).
  Не обращается к схемам других контекстов напрямую.
  """

  import Ecto.Query

  alias ChatForge.Repo
  alias ChatForge.Chat.{EndUser, Conversation, Message}
  alias ChatForge.Instances.ChatInstance
  alias ChatForge.Billing

  # =========================================================================
  # Аутентификация End User-ов
  # =========================================================================

  @doc """
  Регистрирует нового End User-а в рамках тенанта.
  Возвращает `{:ok, end_user}` или `{:error, changeset}`.
  """
  def register_end_user(tenant_id, attrs) do
    result =
      %EndUser{}
      |> EndUser.registration_changeset(attrs, tenant_id)
      |> Repo.insert()

    case result do
      {:ok, end_user} ->
        Phoenix.PubSub.broadcast(
          ChatForge.PubSub,
          "accounts:users",
          {:user_registered, %{
            tenant_id: tenant_id,
            end_user_id: end_user.id
          }}
        )
        {:ok, end_user}

      error ->
        error
    end
  end

  @doc """
  Аутентифицирует End User-а в рамках конкретного тенанта.
  End User одного тенанта не может аутентифицироваться в другом.
  Возвращает `{:ok, end_user}` или `{:error, :invalid_credentials}`.
  """
  def authenticate_end_user(tenant_id, email, password) do
    end_user = Repo.get_by(EndUser, email: email, chat_instance_id: tenant_id)

    cond do
      end_user && Bcrypt.verify_pass(password, end_user.password_hash) ->
        {:ok, end_user}

      end_user ->
        {:error, :invalid_credentials}

      true ->
        # Защита от timing attacks
        Bcrypt.no_user_verify()
        {:error, :invalid_credentials}
    end
  end

  @doc """
  Возвращает End User-а по id или `nil`.
  Используется Guardian для загрузки ресурса из claims.
  """
  def get_end_user(id) do
    Repo.get(EndUser, id)
  end

  # =========================================================================
  # Диалоги (Conversations)
  # =========================================================================

  @doc """
  Создаёт новый диалог для End User-а в рамках тенанта.
  Проверяет, что end_user принадлежит данному тенанту.
  title генерируется автоматически по дате создания.

  Возвращает `{:ok, conversation}`, `{:error, :unauthorized}` или `{:error, changeset}`.
  """
  def create_conversation(end_user_id, tenant_id) do
    # Проверяем принадлежность end_user к тенанту
    case Repo.get_by(EndUser, id: end_user_id, chat_instance_id: tenant_id) do
      nil ->
        {:error, :unauthorized}

      _end_user ->
        title = format_conversation_title(Date.utc_today())

        %Conversation{}
        |> Conversation.changeset(%{
          chat_instance_id: tenant_id,
          end_user_id: end_user_id,
          title: title
        })
        |> Repo.insert()
    end
  end

  @doc """
  Возвращает список диалогов пользователя в тенанте.
  Сортировка: updated_at DESC (последние активные — первыми).
  """
  def list_conversations(end_user_id, tenant_id) do
    Conversation
    |> where([c], c.end_user_id == ^end_user_id and c.chat_instance_id == ^tenant_id)
    |> order_by([c], desc: c.updated_at)
    |> Repo.all()
  end

  @doc """
  Возвращает диалог по id с проверкой владельца и тенанта.
  Возвращает `{:ok, conversation}` или `{:error, :not_found}`.
  """
  def get_conversation(conversation_id, end_user_id, tenant_id) do
    case Repo.get_by(Conversation,
           id: conversation_id,
           end_user_id: end_user_id,
           chat_instance_id: tenant_id
         ) do
      nil -> {:error, :not_found}
      conversation -> {:ok, conversation}
    end
  end

  @doc """
  Удаляет диалог и все связанные сообщения (каскадное удаление через FK).
  Проверяет принадлежность диалога end_user-у.

  Возвращает `{:ok, :deleted}` или `{:error, :not_found}`.
  """
  def delete_conversation(conversation_id, end_user_id) do
    case Repo.get_by(Conversation, id: conversation_id, end_user_id: end_user_id) do
      nil ->
        {:error, :not_found}

      conversation ->
        Repo.delete(conversation)
        {:ok, :deleted}
    end
  end

  @doc """
  Возвращает сообщения диалога с пагинацией.
  Сортировка: inserted_at ASC (хронологический порядок).

  Возвращает `%{messages: [...], total_count: n, has_more: bool}`.
  """
  def get_messages(conversation_id, params) do
    page = Map.get(params, :page, 1)
    per_page = Map.get(params, :per_page, 50)
    offset = (page - 1) * per_page

    total_count =
      Message
      |> where([m], m.conversation_id == ^conversation_id)
      |> Repo.aggregate(:count, :id)

    messages =
      Message
      |> where([m], m.conversation_id == ^conversation_id)
      |> order_by([m], asc: m.inserted_at)
      |> limit(^per_page)
      |> offset(^offset)
      |> Repo.all()

    %{
      messages: messages,
      total_count: total_count,
      has_more: total_count > offset + length(messages)
    }
  end

  # =========================================================================
  # Сообщения и лимиты
  # =========================================================================

  @doc """
  Сохраняет сообщение пользователя (role: "user").
  Публикует событие message.sent через PubSub.

  Возвращает `{:ok, message}` или `{:error, changeset}`.
  """
  def send_message(conversation_id, end_user_id, content) do
    # Получаем диалог для извлечения chat_instance_id
    case Repo.get_by(Conversation, id: conversation_id, end_user_id: end_user_id) do
      nil ->
        {:error, :not_found}

      conversation ->
        result =
          %Message{}
          |> Message.changeset(%{
            conversation_id: conversation_id,
            chat_instance_id: conversation.chat_instance_id,
            role: "user",
            content: content
          })
          |> Repo.insert()

        case result do
          {:ok, message} ->
            payload = %{
              conversation_id: conversation_id,
              tenant_id: conversation.chat_instance_id
            }

            # Публикуем в топик диалога (для Channel)
            Phoenix.PubSub.broadcast(
              ChatForge.PubSub,
              "chat:#{conversation_id}",
              {:message_sent, payload}
            )

            # Публикуем в глобальный топик (для Analytics.EventHandler)
            Phoenix.PubSub.broadcast(
              ChatForge.PubSub,
              "chat:messages",
              {:message_sent, payload}
            )

            {:ok, message}

          error ->
            error
        end
    end
  end

  @doc """
  Сохраняет ответ AI (role: "assistant") с количеством токенов.
  Обновляет updated_at диалога.

  Возвращает `{:ok, message}` или `{:error, changeset}`.
  """
  def save_ai_response(conversation_id, content, tokens_used) do
    case Repo.get(Conversation, conversation_id) do
      nil ->
        {:error, :not_found}

      conversation ->
        result =
          %Message{}
          |> Message.changeset(%{
            conversation_id: conversation_id,
            chat_instance_id: conversation.chat_instance_id,
            role: "assistant",
            content: content,
            tokens_used: tokens_used
          })
          |> Repo.insert()

        # Обновляем updated_at диалога чтобы он поднялся в списке
        case result do
          {:ok, message} ->
            Conversation
            |> where([c], c.id == ^conversation_id)
            |> Repo.update_all(set: [updated_at: DateTime.utc_now()])

            {:ok, message}

          error ->
            error
        end
    end
  end

  @doc """
  Проверяет лимит сообщений для End User-а.

  Логика (в порядке приоритета):
  1. Если есть активная подписка с `message_limit: nil` — безлимитный доступ.
  2. Если есть активная подписка с числовым лимитом — сравниваем с `messages_used`.
  3. Если подписки нет — применяем бесплатный лимит инстанса.

  При достижении лимита публикует событие `limit.reached` через PubSub.

  Возвращает `{:ok, :allowed}` или `{:error, :limit_reached}`.
  """
  def check_limit(end_user_id, tenant_id) do
    result =
      case Billing.get_active_subscription(end_user_id, tenant_id) do
        # Безлимитная подписка — всегда разрешено
        {:ok, %{plan: %{message_limit: nil}}} ->
          {:ok, :allowed}

        # Подписка с числовым лимитом — сравниваем с messages_used
        {:ok, %{plan: %{message_limit: limit}}} when is_integer(limit) ->
          case Repo.get_by(EndUser, id: end_user_id, chat_instance_id: tenant_id) do
            %EndUser{messages_used: messages_used} when messages_used < limit ->
              {:ok, :allowed}

            %EndUser{} ->
              {:error, :limit_reached}

            nil ->
              {:error, :not_found}
          end

        # Нет активной подписки — применяем бесплатный лимит инстанса
        {:ok, nil} ->
          check_free_limit(end_user_id, tenant_id)
      end

    # Публикуем событие при достижении лимита
    if result == {:error, :limit_reached} do
      Phoenix.PubSub.broadcast(
        ChatForge.PubSub,
        "chat:limits",
        {:limit_reached, %{end_user_id: end_user_id, tenant_id: tenant_id}}
      )
    end

    result
  end

  @doc """
  Атомарно увеличивает счётчик messages_used на 1.
  Использует Repo.update_all для атомарности.

  Возвращает `{:ok, updated_end_user}`.
  """
  def increment_usage(end_user_id) do
    {1, _} =
      EndUser
      |> where([u], u.id == ^end_user_id)
      |> Repo.update_all(inc: [messages_used: 1])

    updated = Repo.get!(EndUser, end_user_id)
    {:ok, updated}
  end

  # =========================================================================
  # Приватные функции
  # =========================================================================

  # Форматирует заголовок диалога по дате
  defp format_conversation_title(date) do
    "Диалог от #{Calendar.strftime(date, "%d.%m.%Y")}"
  end

  # Проверяет бесплатный лимит инстанса (используется когда нет активной подписки).
  # Сравнивает messages_used с free_messages_limit из настроек ChatInstance.
  # Если free_messages_limit == nil — лимит не установлен, всегда разрешено.
  defp check_free_limit(end_user_id, tenant_id) do
    with %EndUser{messages_used: messages_used} <-
           Repo.get_by(EndUser, id: end_user_id, chat_instance_id: tenant_id),
         %ChatInstance{free_messages_limit: limit} <- Repo.get(ChatInstance, tenant_id) do
      cond do
        is_nil(limit) -> {:ok, :allowed}
        messages_used >= limit -> {:error, :limit_reached}
        true -> {:ok, :allowed}
      end
    else
      nil -> {:error, :not_found}
    end
  end
end
