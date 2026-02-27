defmodule ChatForge.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    # Таблица пользователей платформы (Creator-ы и Super Admin-ы)
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      add :email, :string, null: false
      add :password_hash, :string, null: false
      add :name, :string, null: false
      add :phone, :string
      add :telegram, :string
      # Роль: creator | super_admin
      add :role, :string, null: false, default: "creator"

      timestamps()
    end

    # Уникальный индекс на email — один аккаунт на email
    create unique_index(:users, [:email])
  end
end
