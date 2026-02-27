defmodule ChatForge.Repo.Migrations.CreateAiUsageLogs do
  use Ecto.Migration

  def change do
    # Логи использования AI API — для аналитики и биллинга
    create table(:ai_usage_logs, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      # tenant_id — лог принадлежит конкретному инстансу
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :delete_all),
          null: false

      add :conversation_id,
          references(:conversations, type: :binary_id, on_delete: :delete_all),
          null: false

      # Провайдер: openai
      add :provider, :string, null: false
      add :model, :string, null: false
      add :input_tokens, :integer, null: false, default: 0
      add :output_tokens, :integer, null: false, default: 0
      # Стоимость запроса в USD
      add :cost, :decimal, precision: 10, scale: 6, null: false, default: 0

      # Только inserted_at — логи иммутабельны
      add :inserted_at, :utc_datetime, null: false
    end

    create index(:ai_usage_logs, [:chat_instance_id])
    create index(:ai_usage_logs, [:conversation_id])
    # Индекс для сортировки по inserted_at DESC (последние логи первыми)
    create index(:ai_usage_logs, [:inserted_at])
  end
end
