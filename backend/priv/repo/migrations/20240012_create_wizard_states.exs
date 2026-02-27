defmodule ChatForge.Repo.Migrations.CreateWizardStates do
  use Ecto.Migration

  def change do
    create table(:wizard_states, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      add :creator_id,
          references(:users, type: :binary_id, on_delete: :delete_all),
          null: false
      add :current_step, :integer, null: false, default: 1
      add :draft_settings, :map, default: %{}

      timestamps()
    end

    create unique_index(:wizard_states, [:creator_id])
  end
end
