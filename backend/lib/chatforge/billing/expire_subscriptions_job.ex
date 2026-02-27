defmodule ChatForge.Billing.ExpireSubscriptionsJob do
  @moduledoc """
  Oban job для истечения просроченных подписок.

  Запускается ежедневно в 00:00 UTC по расписанию Oban cron.
  Делегирует логику в ChatForge.Billing.expire_subscriptions/0.
  """

  use Oban.Worker, queue: :billing

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    # Вызываем бизнес-логику из Billing контекста
    {:ok, _count} = ChatForge.Billing.expire_subscriptions()
    :ok
  end
end
