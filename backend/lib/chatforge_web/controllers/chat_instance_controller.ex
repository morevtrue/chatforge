defmodule ChatForgeWeb.ChatInstanceController do
  @moduledoc """
  Контроллер публичной информации о чат-инстансе для End User-а.

  Маршруты:
  - GET /api/v1/chat/instance — публичные поля инстанса (без system_prompt и финансов)
  """

  use ChatForgeWeb, :controller

  @doc """
  GET /api/v1/chat/instance
  Возвращает публичные поля инстанса из conn.assigns.tenant.
  HTTP 200 или HTTP 404 если тенант не найден.
  """
  def show(conn, _params) do
    case conn.assigns[:tenant_id] do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      tenant_id ->
        instance =
          ChatForge.Repo.get(ChatForge.Instances.ChatInstance, tenant_id)
          |> ChatForge.Repo.preload(:instance_settings)

        case instance do
          nil ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "not_found"})

          instance ->
            conn
            |> put_status(:ok)
            |> json(%{instance: instance_json(instance)})
        end
    end
  end

  # -------------------------------------------------------------------------
  # Приватные функции
  # -------------------------------------------------------------------------

  # Сериализует только публичные поля инстанса
  # Намеренно исключает: system_prompt, creator_id, финансовые настройки
  defp instance_json(instance) do
    settings = instance.instance_settings

    %{
      id: instance.id,
      name: instance.name,
      primary_color: settings && settings.primary_color,
      secondary_color: settings && settings.secondary_color,
      background_color: settings && settings.background_color,
      avatar_url: settings && settings.avatar_url,
      greeting_text: settings && settings.greeting_text,
      example_questions: (settings && settings.example_questions) || []
    }
  end
end
