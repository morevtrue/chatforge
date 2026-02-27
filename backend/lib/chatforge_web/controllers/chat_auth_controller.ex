defmodule ChatForgeWeb.ChatAuthController do
  @moduledoc """
  Контроллер аутентификации End User-ов чат-инстанса.
  Все маршруты требуют наличия тенанта (pipeline :chat_tenant).

  Маршруты:
  - POST /api/v1/chat/auth/register — регистрация End User-а
  - POST /api/v1/chat/auth/login    — вход End User-а
  - POST /api/v1/chat/auth/logout   — выход (требует auth)
  - GET  /api/v1/chat/auth/me       — профиль (требует auth)
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Chat
  alias ChatForge.Guardian

  @doc """
  POST /api/v1/chat/auth/register
  Регистрирует End User-а в рамках тенанта из conn.assigns.tenant_id.
  """
  def register(conn, params) do
    tenant_id = conn.assigns.tenant_id

    case Chat.register_end_user(tenant_id, params) do
      {:ok, end_user} ->
        {:ok, access_token, refresh_token} = Guardian.create_tokens(end_user)

        conn
        |> put_status(:created)
        |> json(%{
          end_user: end_user_json(end_user),
          access_token: access_token,
          refresh_token: refresh_token
        })

      {:error, changeset} ->
        errors = format_changeset_errors(changeset)
        status = if has_unique_error?(changeset), do: :unprocessable_entity, else: :bad_request

        conn
        |> put_status(status)
        |> json(%{errors: errors})
    end
  end

  @doc """
  POST /api/v1/chat/auth/login
  Аутентифицирует End User-а в рамках тенанта.
  """
  def login(conn, %{"email" => email, "password" => password}) do
    tenant_id = conn.assigns.tenant_id

    case Chat.authenticate_end_user(tenant_id, email, password) do
      {:ok, end_user} ->
        {:ok, access_token, refresh_token} = Guardian.create_tokens(end_user)

        conn
        |> put_status(:ok)
        |> json(%{
          end_user: end_user_json(end_user),
          access_token: access_token,
          refresh_token: refresh_token
        })

      {:error, :invalid_credentials} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "invalid_credentials"})
    end
  end

  def login(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{base: ["email и password обязательны"]}})
  end

  @doc """
  POST /api/v1/chat/auth/logout
  Отзывает refresh-токен End User-а.
  """
  def logout(conn, %{"refresh_token" => refresh_token}) do
    Guardian.revoke_refresh_token(refresh_token)

    conn
    |> put_status(:ok)
    |> json(%{ok: true})
  end

  def logout(conn, _params) do
    conn
    |> put_status(:ok)
    |> json(%{ok: true})
  end

  @doc """
  GET /api/v1/chat/auth/me
  Возвращает профиль текущего End User-а.
  """
  def me(conn, _params) do
    end_user = conn.assigns.current_user

    conn
    |> put_status(:ok)
    |> json(%{end_user: end_user_json(end_user)})
  end

  # -------------------------------------------------------------------------
  # Приватные функции
  # -------------------------------------------------------------------------

  defp end_user_json(end_user) do
    %{
      id: end_user.id,
      email: end_user.email,
      name: end_user.name,
      messages_used: end_user.messages_used,
      chat_instance_id: end_user.chat_instance_id
    }
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end

  defp has_unique_error?(changeset) do
    changeset.errors
    |> Keyword.get_values(:email)
    |> Enum.any?(fn {_msg, opts} -> opts[:constraint] == :unique end)
  end
end
