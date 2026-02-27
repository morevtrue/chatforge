defmodule ChatForge.Chat.Conversation do
  @moduledoc """
  Ecto-схема диалога между End User-ом и AI.
  Отображает таблицу `conversations`.
  Каждый диалог изолирован по chat_instance_id (tenant_id).
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "conversations" do
    field :title, :string

    belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
               foreign_key: :chat_instance_id

    belongs_to :end_user, ChatForge.Chat.EndUser

    timestamps()
  end

  @doc """
  Changeset для создания диалога.
  Обязательные поля: chat_instance_id, end_user_id.
  title опционален — генерируется автоматически.
  """
  def changeset(conversation, attrs) do
    conversation
    |> cast(attrs, [:chat_instance_id, :end_user_id, :title])
    |> validate_required([:chat_instance_id, :end_user_id])
    |> validate_length(:title, max: 255)
    |> foreign_key_constraint(:chat_instance_id)
    |> foreign_key_constraint(:end_user_id)
  end
end
