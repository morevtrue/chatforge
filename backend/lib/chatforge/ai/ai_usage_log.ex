defmodule ChatForge.AI.AIUsageLog do
  @moduledoc """
  Ecto-схема записи об использовании AI API.
  Отображает таблицу `ai_usage_logs`.
  Логи иммутабельны — только inserted_at.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "ai_usage_logs" do
    field :provider,      :string
    field :model,         :string
    field :input_tokens,  :integer
    field :output_tokens, :integer
    field :cost,          :decimal

    belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
               foreign_key: :chat_instance_id

    belongs_to :conversation, ChatForge.Chat.Conversation

    # Логи иммутабельны — только inserted_at
    timestamps(updated_at: false)
  end

  @doc "Changeset для создания записи лога использования AI."
  def changeset(log, attrs) do
    log
    |> cast(attrs, [
      :chat_instance_id, :conversation_id, :provider,
      :model, :input_tokens, :output_tokens, :cost
    ])
    |> validate_required([
      :chat_instance_id, :conversation_id, :provider,
      :model, :input_tokens, :output_tokens, :cost
    ])
    |> validate_inclusion(:provider, ["openai"],
        message: "поддерживается только 'openai'")
    |> validate_number(:input_tokens, greater_than_or_equal_to: 0)
    |> validate_number(:output_tokens, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:chat_instance_id)
    |> foreign_key_constraint(:conversation_id)
  end
end
