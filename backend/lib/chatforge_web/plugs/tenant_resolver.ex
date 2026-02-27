defmodule ChatForgeWeb.Plugs.TenantResolver do
  @moduledoc """
  Plug для определения тенанта по поддомену из Host header.

  Алгоритм:
  1. Извлекает поддомен из Host header (формат `<subdomain>.chatforge.app`).
  2. Проверяет Redis-кеш по ключу `tenant:<subdomain>` (TTL 5 минут).
  3. При cache miss: ищет ChatInstance в БД, кеширует результат.
  4. При успехе: кладёт `tenant_id` и `chat_instance` в `conn.assigns`.
  5. При отсутствии поддомена в БД: останавливает pipeline с HTTP 404.
  6. При недоступности Redis: fallback на запрос к БД.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  alias ChatForge.Instances

  # TTL кеша тенанта в секундах (5 минут)
  @cache_ttl_seconds 5 * 60

  def init(opts), do: opts

  def call(conn, _opts) do
    host = get_req_header(conn, "host") |> List.first("")

    subdomain =
      case extract_subdomain(host) do
        # Нет субдомена в Host — пробуем X-Subdomain (Vite proxy dev)
        nil ->
          get_req_header(conn, "x-subdomain") |> List.first(nil)
        # Dev-fallback (чистый localhost) — X-Subdomain имеет приоритет
        :dev_fallback ->
          case get_req_header(conn, "x-subdomain") |> List.first(nil) do
            nil -> :dev_fallback
            sub -> sub
          end
        found ->
          found
      end

    case subdomain do
      nil ->
        conn
      sub ->
        resolve_tenant(conn, sub)
    end
  end

  # Извлекает поддомен из host вида `<subdomain>.chatforge.app`
  defp extract_subdomain(host) do
    # Убираем порт если есть
    host = host |> String.split(":") |> List.first()

    case String.split(host, ".") do
      [subdomain, "chatforge", "app"] -> subdomain
      # Для локальной разработки поддерживаем `<subdomain>.localhost`
      [subdomain, "localhost"] -> subdomain
      # Dev-fallback: чистый localhost — берём первый инстанс из БД
      ["localhost"] -> :dev_fallback
      _ -> nil
    end
  end

  defp resolve_tenant(conn, :dev_fallback) do
    # Dev-режим: localhost без поддомена — берём последний созданный инстанс из БД
    import Ecto.Query
    case ChatForge.Repo.one(from i in ChatForge.Instances.ChatInstance, order_by: [desc: i.inserted_at], limit: 1) do
      nil -> not_found(conn)
      chat_instance -> assign_tenant(conn, chat_instance)
    end
  end

  defp resolve_tenant(conn, subdomain) do
    case get_from_cache(subdomain) do
      {:ok, chat_instance} ->
        assign_tenant(conn, chat_instance)

      :miss ->
        case get_from_db(subdomain) do
          nil ->
            not_found(conn)

          chat_instance ->
            put_in_cache(subdomain, chat_instance)
            assign_tenant(conn, chat_instance)
        end
    end
  end

  defp assign_tenant(conn, chat_instance) do
    conn
    |> assign(:tenant_id, chat_instance.id)
    |> assign(:chat_instance, chat_instance)
  end

  # Ищет ChatInstance в Redis-кеше
  defp get_from_cache(subdomain) do
    key = cache_key(subdomain)

    case Redix.command(:redix, ["GET", key]) do
      {:ok, nil} ->
        :miss

      {:ok, json} ->
        case Jason.decode(json) do
          {:ok, data} -> {:ok, deserialize_instance(data)}
          _ -> :miss
        end

      {:error, _} ->
        # Redis недоступен — fallback на БД
        :miss
    end
  end

  # Сохраняет ChatInstance в Redis-кеш
  defp put_in_cache(subdomain, chat_instance) do
    key = cache_key(subdomain)
    json = Jason.encode!(serialize_instance(chat_instance))

    # Игнорируем ошибки Redis — кеш не критичен
    Redix.command(:redix, ["SET", key, json, "EX", @cache_ttl_seconds])
    :ok
  end

  # Ищет ChatInstance в БД через публичный API контекста Instances
  defp get_from_db(subdomain) do
    case Instances.get_instance_by_subdomain(subdomain) do
      {:ok, instance} -> instance
      {:error, :not_found} -> nil
    end
  end

  defp cache_key(subdomain), do: "tenant:#{subdomain}"

  # Сериализует ChatInstance в map для JSON
  defp serialize_instance(instance) do
    %{
      "id" => to_string(instance.id),
      "name" => instance.name,
      "subdomain" => instance.subdomain,
      "status" => instance.status
    }
  end

  # Десериализует map из JSON обратно в map (не в структуру — алиас ChatInstance убран)
  defp deserialize_instance(data) do
    %{
      id: data["id"],
      name: data["name"],
      subdomain: data["subdomain"],
      status: data["status"]
    }
  end

  defp not_found(conn) do
    conn
    |> put_status(:not_found)
    |> json(%{error: "not_found"})
    |> halt()
  end
end
