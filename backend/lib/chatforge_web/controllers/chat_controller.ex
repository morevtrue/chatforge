defmodule ChatForgeWeb.ChatController do
  @moduledoc """
  Контроллер REST API для диалогов End User-а.

  Маршруты:
  - GET    /api/v1/chat/conversations              — список диалогов
  - POST   /api/v1/chat/conversations              — создать диалог
  - DELETE /api/v1/chat/conversations/:id          — удалить диалог
  - GET    /api/v1/chat/conversations/:id/messages — сообщения с пагинацией
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Chat

  @doc """
  GET /api/v1/chat/conversations
  Возвращает список диалогов текущего End User-а в тенанте.
  """
  def index(conn, _params) do
    end_user = conn.assigns.current_user
    tenant_id = conn.assigns.tenant_id

    conversations = Chat.list_conversations(end_user.id, tenant_id)

    conn
    |> put_status(:ok)
    |> json(%{conversations: Enum.map(conversations, &conversation_json/1)})
  end

  @doc """
  POST /api/v1/chat/conversations
  Создаёт новый диалог для End User-а.
  HTTP 201 или HTTP 422 при ошибке.
  """
  def create(conn, _params) do
    end_user = conn.assigns.current_user
    tenant_id = conn.assigns.tenant_id

    case Chat.create_conversation(end_user.id, tenant_id) do
      {:ok, conversation} ->
        conn
        |> put_status(:created)
        |> json(%{conversation: conversation_json(conversation)})

      {:error, :unauthorized} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "unauthorized"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  @doc """
  DELETE /api/v1/chat/conversations/:id
  Удаляет диалог (каскадно удаляет сообщения).
  HTTP 200 или HTTP 404.
  """
  def delete(conn, %{"id" => id}) do
    end_user = conn.assigns.current_user

    case Chat.delete_conversation(id, end_user.id) do
      {:ok, :deleted} ->
        conn
        |> put_status(:ok)
        |> json(%{ok: true})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})
    end
  end

  @doc """
  GET /api/v1/chat/conversations/:id/messages
  Возвращает сообщения диалога с пагинацией.
  Параметры: page (default: 1), per_page (default: 50).
  HTTP 200 с %{messages, total_count, has_more, page, per_page} или HTTP 404.
  """
  def messages(conn, %{"id" => id} = params) do
    end_user = conn.assigns.current_user
    tenant_id = conn.assigns.tenant_id

    # Проверяем принадлежность диалога
    case Chat.get_conversation(id, end_user.id, tenant_id) do
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      {:ok, _conversation} ->
        page = parse_int(params["page"], 1)
        per_page = parse_int(params["per_page"], 50)

        %{messages: messages, total_count: total_count, has_more: has_more} =
          Chat.get_messages(id, %{page: page, per_page: per_page})

        conn
        |> put_status(:ok)
        |> json(%{
          messages: Enum.map(messages, &message_json/1),
          total_count: total_count,
          has_more: has_more,
          page: page,
          per_page: per_page
        })
    end
  end

  # -------------------------------------------------------------------------
  # Приватные функции
  # -------------------------------------------------------------------------

  defp conversation_json(conv) do
    %{
      id: conv.id,
      title: conv.title,
      inserted_at: conv.inserted_at,
      updated_at: conv.updated_at
    }
  end

  defp message_json(msg) do
    %{
      id: msg.id,
      role: msg.role,
      content: msg.content,
      tokens_used: msg.tokens_used,
      inserted_at: msg.inserted_at
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end

  defp parse_int(nil, default), do: default
  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} when n > 0 -> n
      _ -> default
    end
  end
  defp parse_int(val, _default) when is_integer(val) and val > 0, do: val
  defp parse_int(_, default), do: default
end
