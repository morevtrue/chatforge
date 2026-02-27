defmodule ChatForge.Chat.EndUser do
  @moduledoc """
  Ecto-схема конечного пользователя чат-инстанса (End User).
  Отображает таблицу `end_users`.
  Email уникален в рамках одного chat_instance_id (тенанта).
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "end_users" do
    field :email,         :string
    field :password_hash, :string
    field :name,          :string
    field :messages_used, :integer, default: 0
    # Виртуальное поле — не хранится в БД
    field :password,      :string, virtual: true

    belongs_to :chat_instance, ChatForge.Instances.ChatInstance

    timestamps()
  end

  @doc """
  Changeset для регистрации End User-а.
  Email уникален в рамках одного tenant (chat_instance_id).
  """
  def registration_changeset(end_user, attrs, tenant_id) do
    end_user
    |> cast(attrs, [:email, :password, :name])
    |> validate_required([:email, :password, :name])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/, message: "неверный формат email")
    |> validate_length(:password, min: 8, message: "пароль должен содержать минимум 8 символов")
    |> put_change(:chat_instance_id, tenant_id)
    |> unique_constraint(:email,
      name: :end_users_email_instance_index,
      message: "email уже зарегистрирован в этом чате"
    )
    |> put_password_hash()
  end

  # Хэширует пароль через bcrypt и кладёт в поле password_hash.
  defp put_password_hash(%Ecto.Changeset{valid?: true, changes: %{password: password}} = changeset) do
    put_change(changeset, :password_hash, Bcrypt.hash_pwd_salt(password))
  end

  defp put_password_hash(changeset), do: changeset
end
