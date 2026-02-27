defmodule ChatForgeWeb.WebhookController do
  @moduledoc """
  Контроллер фейковых webhook-уведомлений от платёжной системы.

  Маршруты:
  - POST /api/v1/webhooks/payment — подтвердить оплату и создать подписку

  Примечание: верификация подписи не реализована (фейковая реализация).
  В production необходимо добавить проверку HMAC-подписи от платёжного провайдера.
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Billing
  alias ChatForge.Billing.SubscriptionPlan
  alias ChatForge.Repo

  @doc """
  POST /api/v1/webhooks/payment
  Принимает уведомление об успешной оплате.
  Создаёт подписку для пользователя на указанный план.

  Параметры:
  - `plan_id` — UUID тарифного плана
  - `user_id` — UUID End User-а

  HTTP 200 `%{ok: true}` или HTTP 422 при ошибке.
  """
  def payment(conn, %{"plan_id" => plan_id, "user_id" => user_id})
      when is_binary(plan_id) and is_binary(user_id) do
    # Получаем план для определения tenant_id (chat_instance_id)
    case Repo.get(SubscriptionPlan, plan_id) do
      nil ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "plan_not_found"})

      plan ->
        tenant_id = plan.chat_instance_id

        case Billing.create_subscription(user_id, plan_id, tenant_id) do
          {:ok, _subscription} ->
            conn
            |> put_status(:ok)
            |> json(%{ok: true})

          {:error, _reason} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "subscription_failed"})
        end
    end
  end

  # Обработка случая когда plan_id или user_id отсутствуют в params
  def payment(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "plan_id and user_id are required"})
  end
end
