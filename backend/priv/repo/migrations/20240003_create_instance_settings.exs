defmodule ChatForge.Repo.Migrations.CreateInstanceSettings do
  use Ecto.Migration

  def change do
    # Настройки внешнего вида и поведения чат-инстанса
    create table(:instance_settings, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :delete_all),
          null: false

      # Цветовая схема
      add :primary_color, :string
      add :secondary_color, :string
      add :background_color, :string

      # Медиа и контент
      add :avatar_url, :string
      add :greeting_text, :text
      # Примеры вопросов — массив строк в JSONB
      add :example_questions, :map
      # Системный промпт для AI (опционально)
      add :system_prompt, :text

      timestamps()
    end

    # Индекс для быстрого поиска настроек по инстансу
    create index(:instance_settings, [:chat_instance_id])
  end
end
