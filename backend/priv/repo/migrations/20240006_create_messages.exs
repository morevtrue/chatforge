defmodule ChatForge.Repo.Migrations.CreateMessages do
  use Ecto.Migration

  def change do
    # Сообщения в диалогах (изолированы по тенанту)
    create table(:messages, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      add :conversation_id,
          references(:conversations, type: :binary_id, on_delete: :delete_all),
          null: false

      # tenant_id продублирован для эффективной фильтрации без JOIN
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :delete_all),
          null: false

      # Роль отправителя: user | assistant
      add :role, :string, null: false
      add :content, :text, null: false
      # Количество токенов (заполняется после ответа AI)
      add :tokens_used, :integer, null: false, default: 0

      # Только inserted_at — сообщения иммутабельны
      add :inserted_at, :utc_datetime, null: false
    end

    # Индексы для быстрой выборки сообщений по диалогу и тенанту
    create index(:messages, [:conversation_id])
    create index(:messages, [:chat_instance_id])
    # Индекс для сортировки по inserted_at ASC (хронологический порядок)
    create index(:messages, [:inserted_at])
  end
end
