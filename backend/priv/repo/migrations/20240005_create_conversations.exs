defmodule ChatForge.Repo.Migrations.CreateConversations do
  use Ecto.Migration

  def change do
    # Диалоги конечных пользователей с AI (изолированы по тенанту)
    create table(:conversations, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      # tenant_id — обязательный фильтр для изоляции данных
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :delete_all),
          null: false

      add :end_user_id,
          references(:end_users, type: :binary_id, on_delete: :delete_all),
          null: false

      # Заголовок диалога (генерируется автоматически по дате)
      add :title, :string

      timestamps()
    end

    # Индексы для быстрого поиска диалогов по тенанту и пользователю
    create index(:conversations, [:chat_instance_id])
    create index(:conversations, [:end_user_id])
    # Индекс для сортировки по updated_at DESC (список диалогов)
    create index(:conversations, [:updated_at])
  end
end
