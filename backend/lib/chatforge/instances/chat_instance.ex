defmodule ChatForge.Instances.ChatInstance do
  @moduledoc """
  Ecto-схема чат-инстанса (тенанта).
  Отображает таблицу `chat_instances`.

  Каждый инстанс принадлежит одному Creator-у и доступен по уникальному поддомену.
  Статус жизненного цикла: draft → active → suspended.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Допустимые статусы инстанса
  @valid_statuses ["draft", "active", "suspended"]

  # Допустимые валюты
  @valid_currencies ["RUB", "USD", "EUR"]

  schema "chat_instances" do
    field :name,                :string
    field :subdomain,           :string
    field :currency,            :string, default: "RUB"
    field :status,              :string, default: "draft"
    field :free_messages_limit, :integer

    # Связь с Creator-ом (владелец инстанса)
    belongs_to :creator, ChatForge.Accounts.User, foreign_key: :creator_id

    # Настройки внешнего вида инстанса
    has_one :instance_settings, ChatForge.Instances.InstanceSettings

    timestamps()
  end

  @doc """
  Changeset для создания и обновления чат-инстанса.

  Обязательные поля: creator_id, name, subdomain, currency.
  Поддомен должен содержать только строчные буквы, цифры и дефис.
  Статус ограничен значениями: draft, active, suspended.
  Валюта ограничена значениями: RUB, USD, EUR.
  """
  def changeset(chat_instance, attrs) do
    chat_instance
    |> cast(attrs, [:creator_id, :name, :subdomain, :currency, :status, :free_messages_limit])
    |> validate_required([:creator_id, :name, :subdomain, :currency])
    # Поддомен: только строчные буквы, цифры и дефис
    |> validate_format(:subdomain, ~r/^[a-z0-9-]+$/, message: "только строчные буквы, цифры и дефис")
    # Статус должен быть одним из допустимых значений
    |> validate_inclusion(:status, @valid_statuses, message: "недопустимый статус")
    # Валюта должна быть одной из допустимых
    |> validate_inclusion(:currency, @valid_currencies, message: "недопустимая валюта")
    # Поддомен уникален глобально
    |> unique_constraint(:subdomain)
  end
end
