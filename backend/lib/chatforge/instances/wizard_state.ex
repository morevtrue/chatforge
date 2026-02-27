defmodule ChatForge.Instances.WizardState do
  @moduledoc """
  Ecto-схема состояния визарда создания чата.
  Отображает таблицу `wizard_states`.

  Хранит прогресс Creator-а в процессе настройки инстанса.
  Один Creator — один WizardState (уникальное ограничение по creator_id).
  При финализации визарда запись удаляется атомарно.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Допустимые шаги визарда: 1, 2, 3, 4
  @valid_steps Enum.to_list(1..4)

  schema "wizard_states" do
    # Текущий шаг визарда (1–4), по умолчанию начинаем с первого
    field :current_step,   :integer, default: 1
    # Черновик настроек — JSONB, накапливается по мере прохождения шагов
    field :draft_settings, :map,     default: %{}

    # Связь с Creator-ом (владелец состояния визарда)
    belongs_to :creator, ChatForge.Accounts.User, foreign_key: :creator_id

    timestamps()
  end

  @doc """
  Changeset для создания и обновления состояния визарда.

  Обязательное поле: creator_id.
  Шаг должен быть в диапазоне [1, 4].
  Один Creator может иметь только один WizardState.
  """
  def changeset(wizard_state, attrs) do
    wizard_state
    |> cast(attrs, [:creator_id, :current_step, :draft_settings])
    |> validate_required([:creator_id])
    # Шаг визарда должен быть в допустимом диапазоне
    |> validate_inclusion(:current_step, @valid_steps, message: "должен быть от 1 до 4")
    # Один Creator — один WizardState
    |> unique_constraint(:creator_id)
  end
end
