defmodule ChatForge.Billing.FakePayment do
  @moduledoc """
  Фейковый платёжный адаптер для разработки и тестирования.

  Имитирует flow реальной платёжной системы:
  checkout → redirect на success-страницу → webhook создаёт подписку.

  В production этот модуль заменяется на реальный адаптер (Stripe, ЮKassa и т.д.)
  с тем же публичным интерфейсом.
  """

  @doc """
  Создаёт фейковую checkout-сессию.

  Возвращает URL на страницу success с параметрами plan_id и user_id,
  которые страница success использует для вызова webhook.

  ## Параметры
    - `plan_id` — UUID тарифного плана
    - `end_user_id` — UUID пользователя

  ## Возвращает
    `{:ok, url}` — всегда успешно
  """
  def create_checkout_session(plan_id, end_user_id) do
    {:ok, "/chat/subscription/success?plan_id=#{plan_id}&user_id=#{end_user_id}"}
  end
end
