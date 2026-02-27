defmodule ChatForge.Admin do
  @moduledoc """
  Контекст Admin: Super Admin, управление платформой.

  Зона ответственности:
  - Управление всеми Creator-ами и чат-инстансами
  - Мониторинг платформы и системные метрики
  - Административные действия (блокировка, восстановление)

  Доступен только пользователям с ролью super_admin.
  Взаимодействует с другими контекстами только через их публичные API.
  """

  import Ecto.Query

  alias ChatForge.Repo
  alias ChatForge.Accounts
  alias ChatForge.Accounts.User
  alias ChatForge.Instances
  alias ChatForge.Instances.ChatInstance
  alias ChatForge.Chat.EndUser
  alias ChatForge.AI.AIUsageLog
  alias ChatForge.Billing.{Subscription, SubscriptionPlan}

  # =========================================================================
  # Creator-ы
  # =========================================================================

  @doc """
  Список Creator-ов с пагинацией, поиском по email и фильтром по статусу.
  Делегирует в Accounts.list_creators/1.
  """
  def list_creators(opts \\ %{}) do
    result = Accounts.list_creators(opts)

    # Обогащаем Creator-ов количеством инстансов
    creator_ids = Enum.map(result.creators, & &1.id)

    instance_counts =
      from(c in ChatInstance,
        where: c.creator_id in ^creator_ids,
        group_by: c.creator_id,
        select: {c.creator_id, count(c.id)}
      )
      |> Repo.all()
      |> Map.new()

    creators_with_counts =
      Enum.map(result.creators, fn creator ->
        %{creator: creator, instances_count: Map.get(instance_counts, creator.id, 0)}
      end)

    %{result | creators: creators_with_counts}
  end

  @doc """
  Возвращает Creator-а с его инстансами.
  Возвращает `{:ok, %{creator: user, instances: [...]}}` или `{:error, :not_found}`.
  """
  def get_creator_with_instances(creator_id) do
    case Accounts.get_user_by_id(creator_id) do
      nil ->
        {:error, :not_found}

      user ->
        instances = Instances.get_instances_by_creator(creator_id)
        {:ok, %{creator: user, instances: instances}}
    end
  end

  @doc """
  Блокирует Creator-а: устанавливает status = "suspended".
  Также приостанавливает все его инстансы.
  Super Admin не может заблокировать самого себя.

  Возвращает `{:ok, user}`, `{:error, :not_found}` или `{:error, :cannot_suspend_self}`.
  """
  def suspend_creator(admin_user, creator_id) do
    if to_string(admin_user.id) == to_string(creator_id) do
      {:error, :cannot_suspend_self}
    else
      case Accounts.get_user_by_id(creator_id) do
        nil ->
          {:error, :not_found}

        user ->
          # Транзакция: приостанавливаем инстансы + блокируем Creator-а
          Repo.transaction(fn ->
            Instances.suspend_instances_by_creator(creator_id)

            case Accounts.update_user_status(user, "suspended") do
              {:ok, updated_user} -> updated_user
              {:error, changeset} -> Repo.rollback(changeset)
            end
          end)
      end
    end
  end

  @doc """
  Разблокирует Creator-а: устанавливает status = "active".

  Возвращает `{:ok, user}` или `{:error, :not_found}`.
  """
  def activate_creator(_admin_user, creator_id) do
    case Accounts.get_user_by_id(creator_id) do
      nil -> {:error, :not_found}
      user -> Accounts.update_user_status(user, "active")
    end
  end

  # =========================================================================
  # Инстансы
  # =========================================================================

  @doc """
  Список всех инстансов с пагинацией и фильтром по статусу.
  Предзагружает creator для отображения email.
  """
  def list_instances(opts \\ %{}) do
    page     = Map.get(opts, :page, 1)
    per_page = 20
    status   = Map.get(opts, :status)

    base =
      from c in ChatInstance,
        preload: [:creator],
        order_by: [desc: c.inserted_at]

    base = if status && status != "all" && status != "" do
      from c in base, where: c.status == ^status
    else
      base
    end

    total = Repo.aggregate(base, :count, :id)

    instances =
      base
      |> limit(^per_page)
      |> offset(^((page - 1) * per_page))
      |> Repo.all()

    # Обогащаем инстансы количеством end users
    instance_ids = Enum.map(instances, & &1.id)

    end_user_counts =
      from(eu in EndUser,
        where: eu.chat_instance_id in ^instance_ids,
        group_by: eu.chat_instance_id,
        select: {eu.chat_instance_id, count(eu.id)}
      )
      |> Repo.all()
      |> Map.new()

    instances_with_counts =
      Enum.map(instances, fn inst ->
        %{instance: inst, end_users_count: Map.get(end_user_counts, inst.id, 0)}
      end)

    %{instances: instances_with_counts, total: total, page: page, per_page: per_page}
  end

  @doc """
  Приостанавливает инстанс: устанавливает status = "suspended".

  Возвращает `{:ok, instance}` или `{:error, :not_found}`.
  """
  def suspend_instance(_admin_user, instance_id) do
    case Repo.get(ChatInstance, instance_id) do
      nil      -> {:error, :not_found}
      instance -> Instances.update_instance(instance, %{status: "suspended"})
    end
  end

  @doc """
  Восстанавливает инстанс: устанавливает status = "active".

  Возвращает `{:ok, instance}` или `{:error, :not_found}`.
  """
  def activate_instance(_admin_user, instance_id) do
    case Repo.get(ChatInstance, instance_id) do
      nil      -> {:error, :not_found}
      instance -> Instances.update_instance(instance, %{status: "active"})
    end
  end

  # =========================================================================
  # Статистика платформы
  # =========================================================================

  @doc """
  Сводная статистика платформы:
  - total_creators — количество Creator-ов
  - active_instances — количество активных инстансов
  - total_messages — общее количество сообщений (из events)
  - total_revenue — суммарный доход по всем инстансам
  """
  def get_platform_stats do
    total_creators =
      from(u in User, where: u.role == "creator")
      |> Repo.aggregate(:count, :id)

    active_instances =
      from(c in ChatInstance, where: c.status == "active")
      |> Repo.aggregate(:count, :id)

    total_messages =
      from(e in ChatForge.Analytics.Event, where: e.event_type == "message_sent")
      |> Repo.aggregate(:count, :id)

    total_revenue =
      from(s in Subscription,
        join: p in SubscriptionPlan, on: s.plan_id == p.id,
        where: s.status in ["active", "expired"],
        select: sum(p.price)
      )
      |> Repo.one()
      |> then(&(&1 || Decimal.new(0)))

    %{
      total_creators: total_creators,
      active_instances: active_instances,
      total_messages: total_messages,
      total_revenue: total_revenue
    }
  end

  # =========================================================================
  # Использование AI API
  # =========================================================================

  @doc """
  Агрегированная статистика использования AI API за период.
  period: "7d" | "30d"

  Возвращает:
  - total_input_tokens
  - total_output_tokens
  - total_cost
  - by_instance: список %{instance_id, instance_name, input_tokens, output_tokens, cost}
  """
  def get_ai_usage(period) do
    days = parse_period_days(period)
    since = DateTime.add(DateTime.utc_now(), -days, :day)

    totals =
      from(l in AIUsageLog,
        where: l.inserted_at >= ^since,
        select: %{
          total_input_tokens: sum(l.input_tokens),
          total_output_tokens: sum(l.output_tokens),
          total_cost: sum(l.cost)
        }
      )
      |> Repo.one()

    by_instance =
      from(l in AIUsageLog,
        join: c in ChatInstance, on: l.chat_instance_id == c.id,
        where: l.inserted_at >= ^since,
        group_by: [l.chat_instance_id, c.name],
        order_by: [desc: sum(l.cost)],
        select: %{
          instance_id: l.chat_instance_id,
          instance_name: c.name,
          input_tokens: sum(l.input_tokens),
          output_tokens: sum(l.output_tokens),
          cost: sum(l.cost)
        }
      )
      |> Repo.all()

    %{
      total_input_tokens: totals[:total_input_tokens] || 0,
      total_output_tokens: totals[:total_output_tokens] || 0,
      total_cost: totals[:total_cost] || Decimal.new(0),
      by_instance: by_instance
    }
  end

  # =========================================================================
  # Приватные функции
  # =========================================================================

  defp parse_period_days("7d"),  do: 7
  defp parse_period_days("30d"), do: 30
  defp parse_period_days(_),     do: 7
end
