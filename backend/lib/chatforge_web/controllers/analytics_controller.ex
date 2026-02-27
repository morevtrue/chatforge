defmodule ChatForgeWeb.AnalyticsController do
  @moduledoc """
  Контроллер аналитики для Creator-а.

  Маршруты:
  - GET /api/v1/dashboard/analytics/overview          — сводка метрик
  - GET /api/v1/dashboard/analytics/messages?period=  — динамика сообщений
  - GET /api/v1/dashboard/analytics/users?period=     — динамика регистраций
  - GET /api/v1/dashboard/analytics/revenue?period=   — динамика дохода

  Все данные изолированы по chat_instance_id Creator-а.
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Analytics
  alias ChatForge.Instances

  @valid_periods ~w(7d 30d 90d)

  @doc """
  GET /api/v1/dashboard/analytics/overview
  Возвращает сводку: пользователи, сообщения, подписки, доход, конверсия.
  """
  def overview(conn, params) do
    case get_tenant_id(conn, params) do
      {:ok, tenant_id} ->
        data = %{
          total_users:          Analytics.total_users(tenant_id),
          total_messages:       Analytics.total_messages(tenant_id, :day_30),
          active_subscriptions: Analytics.active_subscriptions(tenant_id),
          revenue:              Analytics.revenue(tenant_id, :day_30),
          conversion_rate:      Analytics.conversion_rate(tenant_id)
        }

        conn
        |> put_status(:ok)
        |> json(%{data: data})

      {:error, :no_instance} ->
        conn
        |> put_status(:ok)
        |> json(%{data: empty_overview()})
    end
  end

  @doc """
  GET /api/v1/dashboard/analytics/messages?period=7d|30d|90d
  Возвращает динамику сообщений по дням.
  """
  def messages(conn, %{"period" => period_str} = params) do
    with {:ok, period} <- parse_period(period_str),
         {:ok, tenant_id} <- get_tenant_id(conn, params) do
      stats = Analytics.daily_stats(tenant_id, period, "message_sent")

      conn
      |> put_status(:ok)
      |> json(%{data: stats})
    else
      {:error, :invalid_period} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid period, use: 7d, 30d, 90d"})

      {:error, :no_instance} ->
        conn |> put_status(:ok) |> json(%{data: []})
    end
  end

  def messages(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "period parameter is required"})
  end

  @doc """
  GET /api/v1/dashboard/analytics/users?period=7d|30d|90d
  Возвращает динамику регистраций по дням.
  """
  def users(conn, %{"period" => period_str} = params) do
    with {:ok, period} <- parse_period(period_str),
         {:ok, tenant_id} <- get_tenant_id(conn, params) do
      stats = Analytics.daily_stats(tenant_id, period, "user_registered")

      conn
      |> put_status(:ok)
      |> json(%{data: stats})
    else
      {:error, :invalid_period} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid period, use: 7d, 30d, 90d"})

      {:error, :no_instance} ->
        conn |> put_status(:ok) |> json(%{data: []})
    end
  end

  def users(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "period parameter is required"})
  end

  @doc """
  GET /api/v1/dashboard/analytics/revenue?period=7d|30d|90d
  Возвращает динамику дохода по дням.
  """
  def revenue(conn, %{"period" => period_str} = params) do
    with {:ok, period} <- parse_period(period_str),
         {:ok, tenant_id} <- get_tenant_id(conn, params) do
      stats = Analytics.daily_revenue(tenant_id, period)

      conn
      |> put_status(:ok)
      |> json(%{data: stats})
    else
      {:error, :invalid_period} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid period, use: 7d, 30d, 90d"})

      {:error, :no_instance} ->
        conn |> put_status(:ok) |> json(%{data: []})
    end
  end

  def revenue(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "period parameter is required"})
  end

  # =========================================================================
  # Приватные функции
  # =========================================================================

  # Получает tenant_id: сначала из instance_id в params, иначе — первый инстанс Creator-а
  defp get_tenant_id(conn, %{"instance_id" => instance_id}) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance(instance_id) do
      %{creator_id: ^creator_id} = instance ->
        {:ok, instance.id}

      nil ->
        {:error, :no_instance}

      _ ->
        # Инстанс не принадлежит этому Creator-у
        {:error, :no_instance}
    end
  end

  defp get_tenant_id(conn, _params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:ok, instance} -> {:ok, instance.id}
      {:error, :not_found} -> {:error, :no_instance}
    end
  end

  # Парсит строковый период в атом
  defp parse_period(period) when period in @valid_periods do
    atom =
      case period do
        "7d"  -> :day_7
        "30d" -> :day_30
        "90d" -> :day_90
      end

    {:ok, atom}
  end

  defp parse_period(_), do: {:error, :invalid_period}

  # Пустая сводка для Creator-а без инстанса
  defp empty_overview do
    %{
      total_users:          0,
      total_messages:       0,
      active_subscriptions: 0,
      revenue:              0,
      conversion_rate:      0.0
    }
  end
end
