defmodule ChatForge.Accounts.User do
  @moduledoc """
  Ecto-схема пользователя платформы (Creator).
  Отображает таблицу `users`.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
    field :email,         :string
    field :password_hash, :string
    field :name,          :string
    field :phone,         :string
    field :telegram,      :string
    field :role,          :string, default: "creator"
    field :status,        :string, default: "active"
    # Виртуальное поле — не хранится в БД
    field :password,      :string, virtual: true

    timestamps()
  end

  @doc """
  Changeset для регистрации Creator-а.
  Валидирует формат email, уникальность, длину пароля >= 8, обязательные поля.
  """
  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password, :name, :phone, :telegram])
    |> validate_required([:email, :password, :name])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/, message: "неверный формат email")
    |> validate_length(:password, min: 8, message: "пароль должен содержать минимум 8 символов")
    |> unique_constraint(:email)
    |> put_password_hash()
  end

  @doc """
  Changeset для логина — принимает только email и password.
  """
  def login_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password])
    |> validate_required([:email, :password])
  end

  @doc """
  Changeset для обновления статуса пользователя (active | suspended).
  """
  def status_changeset(user, attrs) do
    user
    |> cast(attrs, [:status])
    |> validate_required([:status])
    |> validate_inclusion(:status, ["active", "suspended"])
  end

  # Хэширует пароль через bcrypt и кладёт в поле password_hash.
  # Пропускает если пароль не изменился или невалиден.
  defp put_password_hash(%Ecto.Changeset{valid?: true, changes: %{password: password}} = changeset) do
    put_change(changeset, :password_hash, Bcrypt.hash_pwd_salt(password))
  end

  defp put_password_hash(changeset), do: changeset
end
