defmodule ChatForge.Analytics.Event do
  @moduledoc """
  Схема аналитического события.
  Append-only лог всех ключевых действий в системе.
  chat_instance_id может быть nil для платформенных событий.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "events" do
    field :event_type, :string
    field :payload, :map, default: %{}
    belongs_to :chat_instance, ChatForge.Instances.ChatInstance

    timestamps(updated_at: false)
  end

  @required_fields [:event_type]
  @optional_fields [:chat_instance_id, :payload]

  def changeset(event, attrs) do
    event
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:event_type, max: 100)
  end
end
