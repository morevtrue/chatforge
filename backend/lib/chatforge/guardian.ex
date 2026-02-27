defmodule ChatForge.Guardian do
  @moduledoc """
  JWT-аутентификация через Guardian.

  Управляет access и refresh токенами:
  - Access-токен: JWT (TTL 24 часа), передаётся в Authorization: Bearer header.
  - Refresh-токен: долгоживущий JWT (TTL 30 дней), хранится в Redis по ключу
    `{user_id}:refresh:{token_hash}`.

  При обновлении токенов старый refresh-токен инвалидируется (ротация).
  """

  use Guardian, otp_app: :chatforge

  alias ChatForge.Accounts
  alias ChatForge.Chat

  # TTL refresh-токена в секундах (30 дней)
  @refresh_ttl_seconds 30 * 24 * 60 * 60

  # -------------------------------------------------------------------------
  # Guardian callbacks
  # -------------------------------------------------------------------------

  @doc """
  Кодирует субъект токена — id пользователя в виде строки.
  """
  def subject_for_token(%{id: id}, _claims), do: {:ok, to_string(id)}
  def subject_for_token(_, _), do: {:error, :unknown_resource}

  @doc """
  Декодирует субъект токена — загружает пользователя из БД.
  Определяет тип по полю `role` в claims.
  """
  def resource_from_claims(%{"sub" => id, "role" => "end_user"} = _claims) do
    case Chat.get_end_user(id) do
      nil -> {:error, :resource_not_found}
      end_user -> {:ok, end_user}
    end
  end

  def resource_from_claims(%{"sub" => id} = _claims) do
    case Accounts.get_user_by_id(id) do
      nil -> {:error, :resource_not_found}
      user -> {:ok, user}
    end
  end

  # -------------------------------------------------------------------------
  # Публичный API
  # -------------------------------------------------------------------------

  @doc """
  Создаёт пару токенов для пользователя (Creator или EndUser).
  Сохраняет refresh-токен в Redis.
  Возвращает `{:ok, access_token, refresh_token}`.
  """
  def create_tokens(user) do
    extra_claims = build_extra_claims(user)

    with {:ok, access_token, _claims} <-
           encode_and_sign(user, extra_claims, token_type: "access", ttl: {24, :hour}),
         {:ok, refresh_token, _claims} <-
           encode_and_sign(user, extra_claims, token_type: "refresh", ttl: {30, :day}),
         :ok <- store_refresh_token(user.id, refresh_token) do
      {:ok, access_token, refresh_token}
    end
  end

  @doc """
  Обновляет пару токенов по refresh-токену (ротация).
  Проверяет наличие токена в Redis, инвалидирует старый, выдаёт новую пару.
  Возвращает `{:ok, access_token, refresh_token}` или `{:error, :invalid_token}`.
  """
  def refresh_tokens(refresh_token) do
    with {:ok, claims} <- decode_and_verify(refresh_token, %{"typ" => "refresh"}),
         user_id = claims["sub"],
         :ok <- verify_refresh_in_redis(user_id, refresh_token),
         {:ok, resource} <- resource_from_claims(claims),
         :ok <- delete_refresh_from_redis(user_id, refresh_token),
         {:ok, access_token, new_refresh_token} <- create_tokens(resource) do
      {:ok, access_token, new_refresh_token}
    else
      {:error, _} -> {:error, :invalid_token}
    end
  end

  @doc """
  Отзывает refresh-токен — удаляет из Redis.
  Идемпотентен: повторный вызов возвращает `{:ok}`.
  """
  def revoke_refresh_token(refresh_token) do
    case decode_and_verify(refresh_token, %{"typ" => "refresh"}) do
      {:ok, claims} ->
        user_id = claims["sub"]
        delete_refresh_from_redis(user_id, refresh_token)
        {:ok}

      {:error, _} ->
        # Невалидный токен — считаем уже отозванным (идемпотентность)
        {:ok}
    end
  end

  # -------------------------------------------------------------------------
  # Приватные функции
  # -------------------------------------------------------------------------

  # Формирует дополнительные claims в зависимости от типа пользователя.
  defp build_extra_claims(%ChatForge.Chat.EndUser{} = end_user) do
    %{"role" => "end_user", "tenant_id" => to_string(end_user.chat_instance_id)}
  end

  defp build_extra_claims(_user) do
    %{"role" => "creator"}
  end

  # Сохраняет refresh-токен в Redis с TTL 30 дней.
  # Ключ: `{user_id}:refresh:{token_hash}`
  defp store_refresh_token(user_id, refresh_token) do
    key = redis_key(user_id, refresh_token)

    case Redix.command(:redix, ["SET", key, "1", "EX", @refresh_ttl_seconds]) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  # Проверяет наличие refresh-токена в Redis.
  defp verify_refresh_in_redis(user_id, refresh_token) do
    key = redis_key(user_id, refresh_token)

    case Redix.command(:redix, ["GET", key]) do
      {:ok, "1"} -> :ok
      {:ok, nil} -> {:error, :invalid_token}
      {:error, _} -> {:error, :invalid_token}
    end
  end

  # Удаляет refresh-токен из Redis.
  defp delete_refresh_from_redis(user_id, refresh_token) do
    key = redis_key(user_id, refresh_token)
    Redix.command(:redix, ["DEL", key])
    :ok
  end

  # Формирует ключ Redis: `{user_id}:refresh:{token_hash}`
  defp redis_key(user_id, refresh_token) do
    token_hash = :crypto.hash(:sha256, refresh_token) |> Base.encode16(case: :lower)
    "#{user_id}:refresh:#{token_hash}"
  end
end
