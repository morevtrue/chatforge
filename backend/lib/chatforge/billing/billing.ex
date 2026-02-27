defmodule ChatForge.Billing do
  @moduledoc """
  Контекст Billing: тарифные планы и подписки.

  Зона ответственности:
  - Создание, обновление и деактивация тарифных планов Creator-а
  - Создание и получение подписок End User-ов
  - Истечение подписок (через Oban job)

  Все запросы фильтруются по chat_instance_id (tenant isolation).
  Не обращается к схемам Chat контекста напрямую.
  """

  import Ecto.Query

  alias ChatForge.Repo
  alias ChatForge.Billing.{SubscriptionPlan, Subscription}

  # =========================================================================
  # Тарифные планы
  # =========================================================================

  @doc """
  Создаёт тарифный план для тенанта.
  Автоматически устанавливает `is_active: true`.

  Возвращает `{:ok, plan}` или `{:error, changeset}`.
  """
  def create_plan(attrs, tenant_id) do
    # Принудительно устанавливаем chat_instance_id и is_active
    attrs =
      attrs
      |> Map.put("chat_instance_id", tenant_id)
      |> Map.put("is_active", true)

    %SubscriptionPlan{}
    |> SubscriptionPlan.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Возвращает список всех тарифных планов тенанта.
  Сортировка: inserted_at ASC (от старых к новым).
  Фильтрация по chat_instance_id.
  """
  def list_plans(tenant_id) do
    SubscriptionPlan
    |> where([p], p.chat_instance_id == ^tenant_id)
    |> order_by([p], asc: p.inserted_at)
    |> Repo.all()
  end

  @doc """
  Обновляет тарифный план по plan_id.
  Ищет план только по id (без фильтра по тенанту — тенант проверяется на уровне контроллера).

  Возвращает `{:ok, updated_plan}`, `{:error, :not_found}` или `{:error, changeset}`.
  """
  def update_plan(plan_id, attrs) do
    case Repo.get(SubscriptionPlan, plan_id) do
      nil ->
        {:error, :not_found}

      plan ->
        plan
        |> SubscriptionPlan.changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Деактивирует тарифный план: устанавливает `is_active: false`.
  Запись из БД не удаляется.

  Возвращает `{:ok, plan}` или `{:error, :not_found}`.
  """
  def deactivate_plan(plan_id) do
    case Repo.get(SubscriptionPlan, plan_id) do
      nil ->
        {:error, :not_found}

      plan ->
        plan
        |> SubscriptionPlan.changeset(%{"is_active" => false})
        |> Repo.update()
    end
  end

  # =========================================================================
  # Аналитические запросы (публичный API для Analytics контекста)
  # =========================================================================

  @doc """
  Возвращает количество активных подписок тенанта.
  Используется Analytics контекстом для метрик.
  """
  def active_subscriptions_count(tenant_id) do
    now = DateTime.utc_now()

    Subscription
    |> where([s],
      s.chat_instance_id == ^tenant_id and
      s.status == "active" and
      s.expires_at > ^now
    )
    |> Repo.aggregate(:count)
  end

  @doc """
  Возвращает суммарный доход тенанта за период.
  since — DateTime, начало периода.
  """
  def revenue_since(tenant_id, since) do
    result =
      Subscription
      |> join(:inner, [s], p in SubscriptionPlan, on: s.plan_id == p.id)
      |> where([s, _p], s.chat_instance_id == ^tenant_id)
      |> where([s, _p], s.inserted_at >= ^since)
      |> select([_s, p], sum(p.price))
      |> Repo.one()

    result || Decimal.new(0)
  end

  @doc """
  Возвращает доход тенанта по дням за период.
  Возвращает список %{date: "YYYY-MM-DD", amount: Decimal}.
  """
  def daily_revenue_since(tenant_id, since) do
    Subscription
    |> join(:inner, [s], p in SubscriptionPlan, on: s.plan_id == p.id)
    |> where([s, _p], s.chat_instance_id == ^tenant_id)
    |> where([s, _p], s.inserted_at >= ^since)
    |> group_by([s, _p], fragment("DATE(?)", s.inserted_at))
    |> order_by([s, _p], asc: fragment("DATE(?)", s.inserted_at))
    |> select([s, p], %{
      date: fragment("DATE(?)::text", s.inserted_at),
      amount: sum(p.price)
    })
    |> Repo.all()
  end

  # =========================================================================
  # Подписки
  # =========================================================================

  @doc """
  Создаёт подписку для End User-а на тарифный план.
  Вычисляет expires_at на основе периода плана:
    - monthly → +30 дней
    - yearly  → +365 дней
  Устанавливает starts_at: DateTime.utc_now(), status: "active".
  После успешного создания публикует событие subscription.created через PubSub.

  Возвращает `{:ok, subscription}` или `{:error, changeset}`.
  """
  def create_subscription(end_user_id, plan_id, tenant_id) do
    # Загружаем план для определения периода
    with %SubscriptionPlan{period: period} <- Repo.get(SubscriptionPlan, plan_id) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      expires_at =
        case period do
          "monthly" -> DateTime.add(now, 30, :day)
          "yearly"  -> DateTime.add(now, 365, :day)
        end

      attrs = %{
        "chat_instance_id" => tenant_id,
        "end_user_id"      => end_user_id,
        "plan_id"          => plan_id,
        "status"           => "active",
        "starts_at"        => now,
        "expires_at"       => expires_at
      }

      result =
        %Subscription{}
        |> Subscription.changeset(attrs)
        |> Repo.insert()

      case result do
        {:ok, subscription} ->
          # Публикуем событие через PubSub
          Phoenix.PubSub.broadcast(
            ChatForge.PubSub,
            "billing:subscriptions",
            {:subscription_created, %{
              subscription_id: subscription.id,
              end_user_id: end_user_id,
              tenant_id: tenant_id
            }}
          )

          {:ok, subscription}

        error ->
          error
      end
    else
      nil -> {:error, :plan_not_found}
    end
  end

  @doc """
  Возвращает активную подписку End User-а в рамках тенанта.
  Условия: status == "active" AND expires_at > NOW() AND chat_instance_id == tenant_id.
  Предзагружает ассоциацию plan.

  Возвращает `{:ok, subscription}` или `{:ok, nil}`.
  """
  def get_active_subscription(end_user_id, tenant_id) do
    now = DateTime.utc_now()

    subscription =
      Subscription
      |> where([s],
        s.end_user_id == ^end_user_id and
        s.chat_instance_id == ^tenant_id and
        s.status == "active" and
        s.expires_at > ^now
      )
      |> order_by([s], desc: s.inserted_at)
      |> limit(1)
      |> preload(:plan)
      |> Repo.one()

    {:ok, subscription}
  end

  @doc """
  Деактивирует все истёкшие подписки.
  Обновляет status: "expired" для всех подписок где status == "active" AND expires_at < NOW().
  Для каждой истёкшей подписки публикует событие subscription.expired через PubSub.

  Возвращает `{:ok, count}` — количество обновлённых записей.
  """
  def expire_subscriptions do
    now = DateTime.utc_now()

    # Получаем список истёкших подписок для публикации событий
    expired_subscriptions =
      Subscription
      |> where([s], s.status == "active" and s.expires_at < ^now)
      |> select([s], %{id: s.id, end_user_id: s.end_user_id, chat_instance_id: s.chat_instance_id})
      |> Repo.all()

    # Атомарно обновляем статус
    {count, _} =
      Subscription
      |> where([s], s.status == "active" and s.expires_at < ^now)
      |> Repo.update_all(set: [status: "expired", updated_at: now])

    # Публикуем события для каждой истёкшей подписки
    Enum.each(expired_subscriptions, fn sub ->
      Phoenix.PubSub.broadcast(
        ChatForge.PubSub,
        "billing:subscriptions",
        {:subscription_expired, %{
          subscription_id: sub.id,
          end_user_id: sub.end_user_id,
          tenant_id: sub.chat_instance_id
        }}
      )
    end)

    {:ok, count}
  end
end
