defmodule ChatForge.Chat.Message do
  @moduledoc """
  Ecto-схема сообщения в диалоге.
  Отображает таблицу `messages`.
  Сообщения иммутабельны — нет updated_at.
  role: "user" | "assistant"
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Допустимые роли отправителя
  @valid_roles ["user", "assistant"]

  schema "messages" do
    field :role,        :string
    field :content,     :string
    field :tokens_used, :integer, default: 0

    belongs_to :conversation,  ChatForge.Chat.Conversation
    belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
               foreign_key: :chat_instance_id

    # Сообщения иммутабельны — только inserted_at
    timestamps(updated_at: false)
  end

  @doc """
  Changeset для создания сообщения.
  Валидирует роль (только user/assistant) и непустой content.
  """
  def changeset(message, attrs) do
    message
    |> cast(attrs, [:conversation_id, :chat_instance_id, :role, :content, :tokens_used])
    |> validate_required([:conversation_id, :chat_instance_id, :role, :content])
    |> validate_inclusion(:role, @valid_roles,
        message: "должна быть 'user' или 'assistant'")
    |> validate_length(:content, min: 1)
    |> validate_content_not_blank()
    |> foreign_key_constraint(:conversation_id)
    |> foreign_key_constraint(:chat_instance_id)
  end

  # Проверяет, что content не состоит только из пробелов
  defp validate_content_not_blank(changeset) do
    validate_change(changeset, :content, fn :content, val ->
      if String.trim(val) == "" do
        [content: "не может быть пустым или состоять только из пробелов"]
      else
        []
      end
    end)
  end
end
