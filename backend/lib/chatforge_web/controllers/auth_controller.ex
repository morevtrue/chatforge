defmodule ChatForgeWeb.AuthController do
  @moduledoc """
  Контроллер аутентификации Creator-ов платформы.

  Маршруты:
  - POST /api/v1/auth/register — регистрация
  - POST /api/v1/auth/login    — вход
  - POST /api/v1/auth/logout   — выход (требует auth)
  - POST /api/v1/auth/refresh  — обновление токенов
  - GET  /api/v1/auth/me       — профиль (требует auth)
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Accounts
  alias ChatForge.Guardian

  @doc """
  POST /api/v1/auth/register
  Регистрирует нового Creator-а.
  Возвращает 201 с {user, access_token, refresh_token}.
  """
  def register(conn, params) do
    case Accounts.register_creator(params) do
      {:ok, user} ->
        {:ok, access_token, refresh_token} = Guardian.create_tokens(user)

        conn
        |> put_status(:created)
        |> json(%{
          user: user_json(user),
          access_token: access_token,
          refresh_token: refresh_token
        })

      {:error, changeset} ->
        errors = format_changeset_errors(changeset)

        # Если есть ошибка уникальности email — 422, иначе 400
        status = if has_unique_error?(changeset), do: :unprocessable_entity, else: :bad_request

        conn
        |> put_status(status)
        |> json(%{errors: errors})
    end
  end

  @doc """
  POST /api/v1/auth/login
  Аутентифицирует Creator-а.
  Возвращает 200 с {user, access_token, refresh_token}.
  """
  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate(email, password) do
      {:ok, user} ->
        {:ok, access_token, refresh_token} = Guardian.create_tokens(user)

        conn
        |> put_status(:ok)
        |> json(%{
          user: user_json(user),
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
  POST /api/v1/auth/logout
  Отзывает refresh-токен. Требует аутентификации.
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
  POST /api/v1/auth/refresh
  Обновляет пару токенов по refresh-токену.
  """
  def refresh(conn, %{"refresh_token" => refresh_token}) do
    case Guardian.refresh_tokens(refresh_token) do
      {:ok, access_token, new_refresh_token} ->
        conn
        |> put_status(:ok)
        |> json(%{
          access_token: access_token,
          refresh_token: new_refresh_token
        })

      {:error, :invalid_token} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "invalid_token"})
    end
  end

  def refresh(conn, _params) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "invalid_token"})
  end

  @doc """
  GET /api/v1/auth/me
  Возвращает профиль текущего Creator-а. Требует аутентификации.
  """
  def me(conn, _params) do
    user = conn.assigns.current_user

    conn
    |> put_status(:ok)
    |> json(%{user: user_json(user)})
  end

  # -------------------------------------------------------------------------
  # Приватные функции
  # -------------------------------------------------------------------------

  defp user_json(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
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
