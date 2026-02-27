defmodule ChatForge.Analytics do
  @moduledoc """
  Контекст Analytics: события, метрики, отчёты.

  Зона ответственности:
  - Запись аналитических событий (event sourcing)
  - Агрегация метрик по чат-инстансам
  - Отчёты для Creator-ов (активность, конверсии)

  Все события изолированы по chat_instance_id (tenant_id).
  Не обращается к схемам других контекстов напрямую —
  только через публичные API (Billing, Chat).
  """

  import Ecto.Query

  alias ChatForge.Repo
  alias ChatForge.Analytics.Event
  alias ChatForge.Chat.EndUser

  # =========================================================================
  # Трекинг событий
  # =========================================================================

  @doc """
  Сохраняет аналитическое событие в БД.
  chat_instance_id может быть nil для платформенных событий.

  Возвращает `{:ok, event}` или `{:error, changeset}`.
  """
  def track(event_type, chat_instance_id, payload \\ %{}) do
    %Event{}
    |> Event.changeset(%{
      event_type: event_type,
      chat_instance_id: chat_instance_id,
      payload: payload
    })
    |> Repo.insert()
  end

  # =========================================================================
  # Агрегация метрик
  # =========================================================================

  @doc """
  Возвращает общее количество end_users тенанта.
  """
  def total_users(tenant_id) do
    EndUser
    |> where([u], u.chat_instance_id == ^tenant_id)
    |> Repo.aggregate(:count)
  end

  @doc """
  Возвращает количество сообщений за период.
  period: :day_7 | :day_30 | :day_90
  """
  def total_messages(tenant_id, period \\ :day_30) do
    since = period_to_datetime(period)

    Event
    |> where([e], e.chat_instance_id == ^tenant_id)
    |> where([e], e.event_type == "message_sent")
    |> where([e], e.inserted_at >= ^since)
    |> Repo.aggregate(:count)
  end

  @doc """
  Возвращает количество уникальных диалогов за период.
  Считает уникальные conversation_id из payload событий message_sent.
  """
  def total_conversations(tenant_id, period \\ :day_30) do
    since = period_to_datetime(period)

    Event
    |> where([e], e.chat_instance_id == ^tenant_id)
    |> where([e], e.event_type == "message_sent")
    |> where([e], e.inserted_at >= ^since)
    |> select([e], fragment("COUNT(DISTINCT payload->>'conversation_id')"))
    |> Repo.one()
    |> case do
      nil -> 0
      count -> count
    end
  end

  @doc """
  Возвращает количество активных подписок тенанта.
  Делегирует в Billing контекст (публичный API).
  """
  def active_subscriptions(tenant_id) do
    ChatForge.Billing.active_subscriptions_count(tenant_id)
  end

  @doc """
  Возвращает доход за период (сумма цен планов для созданных подписок).
  Делегирует в Billing контекст (публичный API).
  period: :day_7 | :day_30 | :day_90
  """
  def revenue(tenant_id, period \\ :day_30) do
    since = period_to_datetime(period)
    ChatForge.Billing.revenue_since(tenant_id, since)
  end

  @doc """
  Возвращает конверсию из бесплатных в платных (%).
  Формула: (active_subscriptions / total_users) * 100
  Возвращает 0.0 если total_users == 0.
  """
  def conversion_rate(tenant_id) do
    users = total_users(tenant_id)

    if users == 0 do
      0.0
    else
      subs = active_subscriptions(tenant_id)
      Float.round(subs / users * 100, 1)
    end
  end

  @doc """
  Возвращает метрики по дням за период для графиков.
  event_type: "message_sent" | "user_registered"
  Возвращает список %{date: "YYYY-MM-DD", count: N}.
  """
  def daily_stats(tenant_id, period, event_type) do
    since = period_to_datetime(period)

    Event
    |> where([e], e.chat_instance_id == ^tenant_id)
    |> where([e], e.event_type == ^event_type)
    |> where([e], e.inserted_at >= ^since)
    |> group_by([e], fragment("DATE(inserted_at)"))
    |> order_by([e], asc: fragment("DATE(inserted_at)"))
    |> select([e], %{
      date: fragment("DATE(inserted_at)::text"),
      count: count(e.id)
    })
    |> Repo.all()
  end

  @doc """
  Возвращает доход по дням за период.
  Делегирует в Billing контекст (публичный API).
  Возвращает список %{date: "YYYY-MM-DD", amount: Decimal}.
  """
  def daily_revenue(tenant_id, period) do
    since = period_to_datetime(period)
    ChatForge.Billing.daily_revenue_since(tenant_id, since)
  end

  # =========================================================================
  # Приватные функции
  # =========================================================================

  defp period_to_datetime(:day_7),  do: DateTime.add(DateTime.utc_now(), -7, :day)
  defp period_to_datetime(:day_30), do: DateTime.add(DateTime.utc_now(), -30, :day)
  defp period_to_datetime(:day_90), do: DateTime.add(DateTime.utc_now(), -90, :day)
end
