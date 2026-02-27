defmodule ChatForge.Repo.Migrations.CreateSubscriptions do
  use Ecto.Migration

  def change do
    # Подписки конечных пользователей на тарифные планы
    create table(:subscriptions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      # tenant_id — подписка принадлежит конкретному инстансу, каскадное удаление
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :delete_all),
          null: false

      # Каскадное удаление при удалении конечного пользователя
      add :end_user_id,
          references(:end_users, type: :binary_id, on_delete: :delete_all),
          null: false

      # Ссылка на тарифный план (без каскадного удаления — план нельзя удалить при наличии подписок)
      add :plan_id,
          references(:subscription_plans, type: :binary_id, on_delete: :restrict),
          null: false

      # Статус: active | expired | cancelled
      add :status, :string, size: 20, null: false
      add :starts_at, :utc_datetime, null: false
      add :expires_at, :utc_datetime, null: false

      timestamps()
    end

    # CHECK-ограничение: допустимые значения статуса
    create constraint(:subscriptions, :status_must_be_valid,
      check: "status IN ('active', 'expired', 'cancelled')"
    )

    # Индекс для поиска подписок конкретного пользователя
    create index(:subscriptions, [:end_user_id])
    # Индекс для фильтрации по тенанту
    create index(:subscriptions, [:chat_instance_id])
    # Индекс для фильтрации по статусу (часто используется в check_limit)
    create index(:subscriptions, [:status])
    # Индекс для Oban job истечения подписок (поиск по expires_at)
    create index(:subscriptions, [:expires_at])
  end
end
