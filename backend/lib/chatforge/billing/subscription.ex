defmodule ChatForge.Billing.Subscription do
  @moduledoc """
  Ecto-схема подписки End User-а на тарифный план.
  Отображает таблицу `subscriptions`.

  Каждая подписка связана с чат-инстансом (тенантом), конечным пользователем и тарифным планом.
  Статус жизненного цикла: active → expired | cancelled.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Допустимые статусы подписки
  @valid_statuses ["active", "expired", "cancelled"]

  schema "subscriptions" do
    # Статус подписки: active, expired или cancelled
    field :status,     :string
    field :starts_at,  :utc_datetime
    field :expires_at, :utc_datetime

    # Принадлежит чат-инстансу (тенанту)
    belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
               foreign_key: :chat_instance_id

    # Принадлежит конечному пользователю
    belongs_to :end_user, ChatForge.Chat.EndUser,
               foreign_key: :end_user_id

    # Принадлежит тарифному плану
    belongs_to :plan, ChatForge.Billing.SubscriptionPlan,
               foreign_key: :plan_id

    timestamps()
  end

  @doc """
  Changeset для создания и обновления подписки.

  Обязательные поля: chat_instance_id, end_user_id, plan_id, status, starts_at, expires_at.
  Статус ограничен значениями: active, expired, cancelled.
  """
  def changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [:chat_instance_id, :end_user_id, :plan_id, :status, :starts_at, :expires_at])
    |> validate_required([:chat_instance_id, :end_user_id, :plan_id, :status, :starts_at, :expires_at])
    # Статус только из допустимых значений
    |> validate_inclusion(:status, @valid_statuses, message: "должен быть active, expired или cancelled")
    # FK-ограничения
    |> foreign_key_constraint(:chat_instance_id)
    |> foreign_key_constraint(:end_user_id)
    |> foreign_key_constraint(:plan_id)
  end
end
