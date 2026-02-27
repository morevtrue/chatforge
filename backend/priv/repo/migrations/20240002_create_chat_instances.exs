defmodule ChatForge.Repo.Migrations.CreateChatInstances do
  use Ecto.Migration

  def change do
    # Таблица чат-инстансов (тенантов) — каждый инстанс принадлежит Creator-у
    create table(:chat_instances, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      add :creator_id, references(:users, type: :binary_id, on_delete: :restrict), null: false
      add :name, :string, null: false
      # Поддомен уникален на всей платформе
      add :subdomain, :string, null: false
      # Валюта инстанса: RUB, USD, EUR и т.д.
      add :currency, :string, null: false
      # Статус: draft | active | suspended
      add :status, :string, null: false, default: "draft"

      timestamps()
    end

    # Уникальный индекс на поддомен — один инстанс на поддомен
    create unique_index(:chat_instances, [:subdomain])
    # Индекс для быстрого поиска инстансов Creator-а
    create index(:chat_instances, [:creator_id])
  end
end
