defmodule ChatForge.Repo.Migrations.CreateEndUsers do
  use Ecto.Migration

  def change do
    # Конечные пользователи чат-инстансов (изолированы по тенанту)
    create table(:end_users, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      # tenant_id — обязательный фильтр для изоляции данных
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :delete_all),
          null: false

      add :email, :string, null: false
      add :password_hash, :string, null: false
      add :name, :string, null: false
      # Счётчик использованных сообщений для проверки лимитов
      add :messages_used, :integer, null: false, default: 0

      timestamps()
    end

    # Уникальный составной индекс: один email на инстанс (изоляция по тенанту)
    # Один и тот же email может быть в разных инстансах
    create unique_index(:end_users, [:email, :chat_instance_id])
    # Индекс для быстрого поиска пользователей по тенанту
    create index(:end_users, [:chat_instance_id])
  end
end
