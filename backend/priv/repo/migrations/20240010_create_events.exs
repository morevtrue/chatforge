defmodule ChatForge.Repo.Migrations.CreateEvents do
  use Ecto.Migration

  def change do
    # Таблица событий для аналитики — append-only лог всех действий в системе
    create table(:events, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      # tenant_id — nullable, т.к. некоторые события платформенные (регистрация Creator-а)
      add :chat_instance_id,
          references(:chat_instances, type: :binary_id, on_delete: :nilify_all)

      # Тип события: user.registered, message.sent, subscription.created и т.д.
      add :event_type, :string, null: false
      # Произвольная полезная нагрузка события
      add :payload, :map, null: false

      # Только inserted_at — события не редактируются
      add :inserted_at, :utc_datetime, null: false
    end

    # Индексы для аналитических запросов
    create index(:events, [:event_type])
    create index(:events, [:chat_instance_id])
    # Составной индекс для запросов по тенанту + типу события
    create index(:events, [:chat_instance_id, :event_type])
  end
end
