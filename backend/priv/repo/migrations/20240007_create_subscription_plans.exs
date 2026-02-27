defmodule ChatForge.Repo.Migrations.CreateSubscriptionPlans do
  use Ecto.Migration

  def change do
    # Тарифные планы, создаваемые Creator-ом для своего инстанса
    create table(:subscription_plans, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      # tenant_id — план принадлежит конкретному инстансу, каскадное удаление
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, size: 255, null: false
      # Цена в валюте инстанса, строго больше нуля
      add :price, :decimal, precision: 10, scale: 2, null: false
      # Период: monthly | yearly
      add :period, :string, size: 20, null: false
      # Лимит сообщений (nil = безлимитный доступ)
      add :message_limit, :integer
      # Активность плана (деактивация вместо удаления)
      add :is_active, :boolean, null: false, default: true

      timestamps()
    end

    # CHECK-ограничение: цена строго больше нуля
    create constraint(:subscription_plans, :price_must_be_positive, check: "price > 0")
    # CHECK-ограничение: допустимые значения периода
    create constraint(:subscription_plans, :period_must_be_valid,
      check: "period IN ('monthly', 'yearly')"
    )

    # Индекс для быстрого поиска планов по тенанту
    create index(:subscription_plans, [:chat_instance_id])
    # Индекс для фильтрации активных планов
    create index(:subscription_plans, [:is_active])
  end
end
