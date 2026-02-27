defmodule ChatForgeWeb.SubscriptionController do
  @moduledoc """
  Контроллер API подписок End User-а.

  Маршруты:
  - GET  /api/v1/chat/plans                — публичный список активных планов тенанта
  - POST /api/v1/chat/subscriptions        — начать оформление подписки (checkout)
  - GET  /api/v1/chat/subscriptions/current — текущая активная подписка пользователя
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Billing
  alias ChatForge.Billing.{FakePayment, SubscriptionPlan}
  alias ChatForge.Repo

  @doc """
  GET /api/v1/chat/plans
  Возвращает список активных тарифных планов тенанта.
  Доступен без аутентификации — только TenantResolver.
  HTTP 200 `%{plans: [...]}`.
  """
  def plans(conn, _params) do
    # tenant_id устанавливается плагом TenantResolver
    tenant_id = conn.assigns.tenant_id

    plans =
      tenant_id
      |> Billing.list_plans()
      |> Enum.filter(& &1.is_active)

    conn
    |> put_status(:ok)
    |> json(%{plans: Enum.map(plans, &plan_json/1)})
  end

  @doc """
  POST /api/v1/chat/subscriptions
  Инициирует оформление подписки через FakePayment.
  Проверяет что план активен и принадлежит тенанту.
  HTTP 200 `%{checkout_url: url}` или HTTP 404.
  """
  def create(conn, params) do
    # end_user_id берётся из аутентифицированного пользователя
    end_user_id = conn.assigns.current_user.id
    # tenant_id устанавливается плагом TenantResolver
    tenant_id = conn.assigns.tenant_id
    plan_id = params["plan_id"]

    # Ищем план и проверяем принадлежность тенанту и активность
    case Repo.get(SubscriptionPlan, plan_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      plan ->
        cond do
          # Проверяем что план принадлежит тенанту
          to_string(plan.chat_instance_id) != to_string(tenant_id) ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "not_found"})

          # Проверяем что план активен
          not plan.is_active ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "not_found"})

          true ->
            # Создаём checkout-сессию через FakePayment
            {:ok, checkout_url} = FakePayment.create_checkout_session(plan_id, end_user_id)

            conn
            |> put_status(:ok)
            |> json(%{checkout_url: checkout_url})
        end
    end
  end

  @doc """
  GET /api/v1/chat/subscriptions/current
  Возвращает текущую активную подписку End User-а.
  HTTP 200 `%{subscription: ...}` или `%{subscription: nil}`.
  """
  def current(conn, _params) do
    # end_user_id берётся из аутентифицированного пользователя
    end_user_id = conn.assigns.current_user.id
    # tenant_id устанавливается плагом TenantResolver
    tenant_id = conn.assigns.tenant_id

    {:ok, subscription} = Billing.get_active_subscription(end_user_id, tenant_id)

    conn
    |> put_status(:ok)
    |> json(%{subscription: subscription_json(subscription)})
  end

  # -------------------------------------------------------------------------
  # Приватные вспомогательные функции
  # -------------------------------------------------------------------------

  # Сериализует SubscriptionPlan в JSON-совместимый формат (публичный — без is_active)
  defp plan_json(plan) do
    %{
      id:            plan.id,
      name:          plan.name,
      price:         plan.price,
      period:        plan.period,
      message_limit: plan.message_limit
    }
  end

  # Сериализует Subscription в JSON-совместимый формат (nil → nil)
  defp subscription_json(nil), do: nil

  defp subscription_json(subscription) do
    %{
      id:         subscription.id,
      status:     subscription.status,
      starts_at:  subscription.starts_at,
      expires_at: subscription.expires_at,
      plan:       plan_json(subscription.plan)
    }
  end
end
