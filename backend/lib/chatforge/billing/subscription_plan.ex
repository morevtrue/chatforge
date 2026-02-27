defmodule ChatForge.Billing.SubscriptionPlan do
  @moduledoc """
  Ecto-схема тарифного плана подписки.
  Отображает таблицу `subscription_plans`.

  Каждый план принадлежит одному чат-инстансу (тенанту).
  Поле `message_limit` может быть nil — означает безлимитный доступ.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Допустимые периоды подписки
  @valid_periods ["monthly", "yearly"]

  schema "subscription_plans" do
    field :name,          :string
    field :price,         :decimal
    # Период: "monthly" или "yearly"
    field :period,        :string
    # Лимит сообщений; nil = безлимитный доступ
    field :message_limit, :integer
    field :is_active,     :boolean, default: true

    # Принадлежит чат-инстансу (тенанту)
    belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
               foreign_key: :chat_instance_id

    timestamps()
  end

  @doc """
  Changeset для создания и обновления тарифного плана.

  Обязательные поля: chat_instance_id, name, price, period.
  Период ограничен значениями: monthly, yearly.
  Цена должна быть строго больше нуля.
  Максимальная длина name — 255 символов.
  """
  def changeset(plan, attrs) do
    plan
    |> cast(attrs, [:chat_instance_id, :name, :price, :period, :message_limit, :is_active])
    |> validate_required([:chat_instance_id, :name, :price, :period])
    # Название не длиннее 255 символов
    |> validate_length(:name, max: 255)
    # Период только из допустимых значений
    |> validate_inclusion(:period, @valid_periods, message: "должен быть monthly или yearly")
    # Цена строго больше нуля
    |> validate_number(:price, greater_than: 0, message: "должна быть больше нуля")
    # FK-ограничение на chat_instance_id
    |> foreign_key_constraint(:chat_instance_id)
  end
end
