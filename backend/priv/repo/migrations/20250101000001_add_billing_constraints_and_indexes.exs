defmodule ChatForge.Repo.Migrations.AddBillingConstraintsAndIndexes do
  use Ecto.Migration

  def change do
    # --- subscription_plans: добавить недостающие ограничения и индексы ---

    # CHECK: цена строго больше нуля
    create constraint(:subscription_plans, :price_must_be_positive, check: "price > 0")
    # CHECK: допустимые значения периода
    create constraint(:subscription_plans, :period_must_be_valid,
      check: "period IN ('monthly', 'yearly')"
    )
    # Индекс для фильтрации активных планов
    create index(:subscription_plans, [:is_active])

    # --- subscriptions: добавить недостающие ограничения и индексы ---

    # CHECK: допустимые значения статуса
    create constraint(:subscriptions, :status_must_be_valid,
      check: "status IN ('active', 'expired', 'cancelled')"
    )
    # Индекс для фильтрации по статусу (используется в check_limit и Oban job)
    create index(:subscriptions, [:status])
    # Индекс для Oban job истечения подписок (поиск по expires_at)
    create index(:subscriptions, [:expires_at])

    # expires_at должен быть NOT NULL согласно спеку
    alter table(:subscriptions) do
      modify :expires_at, :utc_datetime, null: false
    end
  end
end
