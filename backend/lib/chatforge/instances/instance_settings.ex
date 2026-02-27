defmodule ChatForge.Instances.InstanceSettings do
  @moduledoc """
  Ecto-схема настроек внешнего вида чат-инстанса.
  Отображает таблицу `instance_settings`.

  Хранит цветовую схему, аватар, текст приветствия и примеры вопросов.
  Связана один-к-одному с ChatInstance.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Регулярное выражение для проверки формата HEX-цвета (#RRGGBB)
  @color_format ~r/^#[0-9A-Fa-f]{6}$/

  schema "instance_settings" do
    field :primary_color,     :string
    field :secondary_color,   :string
    field :background_color,  :string
    field :avatar_url,        :string
    field :greeting_text,     :string
    # Массив строк — примеры вопросов для пользователя
    field :example_questions, {:array, :string}, default: []
    field :system_prompt,     :string

    # Связь с чат-инстансом (владелец настроек)
    belongs_to :chat_instance, ChatForge.Instances.ChatInstance

    timestamps()
  end

  @doc """
  Changeset для создания и обновления настроек инстанса.

  Обязательное поле: chat_instance_id.
  Цвета должны быть в формате #RRGGBB (6 hex-символов с #).
  Текст приветствия ограничен 1000 символами.
  """
  def changeset(settings, attrs) do
    settings
    |> cast(attrs, [
      :chat_instance_id,
      :primary_color,
      :secondary_color,
      :background_color,
      :avatar_url,
      :greeting_text,
      :example_questions,
      :system_prompt
    ])
    |> validate_required([:chat_instance_id])
    # Валидация формата цветов: #RRGGBB
    |> validate_format(:primary_color,    @color_format, message: "должен быть в формате #RRGGBB")
    |> validate_format(:secondary_color,  @color_format, message: "должен быть в формате #RRGGBB")
    |> validate_format(:background_color, @color_format, message: "должен быть в формате #RRGGBB")
    # Текст приветствия не более 1000 символов
    |> validate_length(:greeting_text, max: 1000, message: "не более 1000 символов")
  end
end
