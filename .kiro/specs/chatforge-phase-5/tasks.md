# План реализации: ChatForge Phase 5 — Подписки и монетизация

## Обзор

Последовательная реализация: миграции → Ecto-схемы → бизнес-логика Billing контекста (планы, подписки, FakePayment, Oban job) → расширение Chat.check_limit/2 → API контроллеры (Creator и End User) → webhook → роутер → Frontend (типы, api, store, Paywall, страницы дашборда, страницы success/cancel, статус подписки в ConversationPage). Каждый шаг строится на предыдущем.

## Задачи

- [x] 1. Миграции базы данных
  - [x] 1.1 Создать миграцию для таблицы `subscription_plans`
    - Создать файл миграции в `backend/priv/repo/migrations/`
    - Поля: `id UUID PK`, `chat_instance_id UUID FK`, `name VARCHAR(255)`, `price DECIMAL(10,2) CHECK > 0`, `period VARCHAR(20) CHECK IN ('monthly','yearly')`, `message_limit INTEGER NULL`, `is_active BOOLEAN DEFAULT TRUE`, `inserted_at`, `updated_at`
    - Индексы: `chat_instance_id`, `is_active`
    - Каскадное удаление при удалении `chat_instances`
    - _Требования: 1.1_

  - [x] 1.2 Создать миграцию для таблицы `subscriptions`
    - Создать файл миграции в `backend/priv/repo/migrations/`
    - Поля: `id UUID PK`, `chat_instance_id UUID FK`, `end_user_id UUID FK`, `plan_id UUID FK`, `status VARCHAR(20) CHECK IN ('active','expired','cancelled')`, `starts_at TIMESTAMP`, `expires_at TIMESTAMP`, `inserted_at`, `updated_at`
    - Индексы: `end_user_id`, `chat_instance_id`, `status`, `expires_at`
    - Каскадное удаление при удалении `chat_instances` и `end_users`
    - _Требования: 1.2_

- [x] 2. Billing контекст — Ecto-схемы
  - [x] 2.1 Реализовать схему `ChatForge.Billing.SubscriptionPlan`
    - Создать `backend/lib/chatforge/billing/subscription_plan.ex`
    - Поля: `name`, `price :decimal`, `period`, `message_limit :integer`, `is_active :boolean`, `belongs_to :chat_instance`, `timestamps()`
    - Changeset: валидация обязательных полей; `validate_inclusion(:period, ["monthly", "yearly"])`; `validate_number(:price, greater_than: 0)`; `validate_length(:name, max: 255)`; FK-ограничение
    - _Требования: 1.1, 1.3, 1.5, 1.6, 1.8_

  - [x] 2.2 Реализовать схему `ChatForge.Billing.Subscription`
    - Создать `backend/lib/chatforge/billing/subscription.ex`
    - Поля: `status`, `starts_at :utc_datetime`, `expires_at :utc_datetime`, `belongs_to :chat_instance`, `belongs_to :end_user`, `belongs_to :plan`, `timestamps()`
    - Changeset: валидация обязательных полей; `validate_inclusion(:status, ["active", "expired", "cancelled"])`; FK-ограничения
    - _Требования: 1.2, 1.4, 1.7_

  - [ ]* 2.3 Написать property-тест для валидации changeset SubscriptionPlan
    - **Свойство 6: Инвариант валидации цены плана**
    - **Validates: Requirements 1.5, 2.2**
    - Для любого `price <= 0` — changeset невалиден с ошибкой на `:price`
    - Для любого `price > 0` — changeset валиден по полю `:price`

- [x] 3. Billing контекст — бизнес-логика планов
  - [x] 3.1 Создать модуль `ChatForge.Billing` с функциями управления планами
    - Создать `backend/lib/chatforge/billing/billing.ex`
    - Реализовать `create_plan/2`: создать план с `is_active: true`, вернуть `{:ok, plan}` или `{:error, changeset}`
    - Реализовать `list_plans/1`: список планов тенанта, отсортированных по `inserted_at ASC`, фильтр по `chat_instance_id`
    - Реализовать `update_plan/2`: найти план по `plan_id`, обновить атрибуты, вернуть `{:ok, plan}` или `{:error, :not_found}` или `{:error, changeset}`
    - Реализовать `deactivate_plan/1`: установить `is_active: false`, вернуть `{:ok, plan}` или `{:error, :not_found}`
    - _Требования: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 3.2 Написать property-тест для tenant-изоляции планов
    - **Свойство 1: Инвариант tenant-изоляции планов**
    - **Validates: Requirements 2.8**
    - Для любых двух тенантов A и B: `Billing.list_plans(A)` не содержит планы тенанта B

- [x] 4. Billing контекст — бизнес-логика подписок
  - [x] 4.1 Реализовать `Billing.create_subscription/3`
    - В `backend/lib/chatforge/billing/billing.ex` добавить функцию
    - Вычислить `expires_at`: monthly → `DateTime.add(now, 30, :day)`, yearly → `DateTime.add(now, 365, :day)`
    - Установить `starts_at: DateTime.utc_now()`, `status: "active"`
    - После успешного создания опубликовать событие `subscription.created` через PubSub
    - _Требования: 3.1, 3.2_

  - [x] 4.2 Реализовать `Billing.get_active_subscription/2`
    - В `backend/lib/chatforge/billing/billing.ex` добавить функцию
    - Запрос: `status == "active"` AND `expires_at > NOW()` AND `chat_instance_id == tenant_id` AND `end_user_id == end_user_id`
    - Предзагрузить ассоциацию `plan`
    - Вернуть `{:ok, subscription}` или `{:ok, nil}`
    - _Требования: 3.3, 3.4_

  - [ ]* 4.3 Написать property-тест для round-trip подписки
    - **Свойство 4: Round-trip — создание и получение подписки**
    - **Validates: Requirements 3.1, 3.3**
    - Если `create_subscription/3` вернул `{:ok, sub}`, то `get_active_subscription/2` возвращает ту же подписку с предзагруженным планом

- [x] 5. Billing контекст — Oban job и FakePayment
  - [x] 5.1 Реализовать `ChatForge.Billing.ExpireSubscriptionsJob`
    - Создать `backend/lib/chatforge/billing/expire_subscriptions_job.ex`
    - `use Oban.Worker, queue: :billing`
    - В `perform/1`: обновить `status: "expired"` для всех подписок где `status == "active"` AND `expires_at < NOW()`
    - Для каждой истёкшей подписки опубликовать событие `subscription.expired` через PubSub
    - Настроить Oban cron в `config/config.exs`: запуск ежедневно
    - _Требования: 3.5, 3.6, 3.7, 3.8_

  - [ ]* 5.2 Написать property-тест для инварианта истечения подписок
    - **Свойство 5: Инвариант истечения подписки**
    - **Validates: Requirements 3.5**
    - Подписки с `expires_at < NOW()` и `status == "active"` после вызова `expire_subscriptions/0` имеют `status == "expired"`
    - Подписки с `expires_at >= NOW()` остаются `active`

  - [x] 5.3 Реализовать `ChatForge.Billing.FakePayment`
    - Создать `backend/lib/chatforge/billing/fake_payment.ex`
    - Функция `create_checkout_session/2` принимает `plan_id` и `end_user_id`
    - Всегда возвращает `{:ok, "/chat/subscription/success?plan_id=#{plan_id}&user_id=#{end_user_id}"}`
    - _Требования: 4.1, 4.2_

- [x] 6. Chat контекст — расширение check_limit/2
  - [x] 6.1 Обновить `Chat.check_limit/2` в `backend/lib/chatforge/chat/chat.ex`
    - Добавить вызов `Billing.get_active_subscription(end_user_id, tenant_id)` в начало функции
    - Если подписка с `message_limit: nil` → вернуть `{:ok, :allowed}`
    - Если подписка с числовым `message_limit` → сравнить с `messages_used`
    - Если нет подписки → применить существующую логику бесплатного лимита
    - При `{:error, :limit_reached}` опубликовать событие `limit.reached` через PubSub
    - _Требования: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.2 Написать property-тест для инварианта безлимитного доступа
    - **Свойство 7: Инвариант безлимитного доступа**
    - **Validates: Requirements 7.2**
    - Для любого `end_user_id` с активной подпиской `message_limit: nil`: `check_limit/2` всегда возвращает `{:ok, :allowed}`

  - [ ]* 6.3 Написать property-тест для инварианта приоритета подписки
    - **Свойство 8: Инвариант приоритета подписки**
    - **Validates: Requirements 7.3**
    - Если `messages_used < plan.message_limit` — результат `{:ok, :allowed}`, даже если `messages_used > free_limit`

- [x] 7. API контроллеры — Creator (управление планами)
  - [x] 7.1 Реализовать `ChatForgeWeb.PlanController`
    - Создать `backend/lib/chatforge_web/controllers/plan_controller.ex`
    - `index/2`: вызвать `Billing.list_plans(tenant_id)`, вернуть JSON 200
    - `create/2`: вызвать `Billing.create_plan(params, tenant_id)`, вернуть JSON 201 или 422
    - `update/2`: вызвать `Billing.update_plan(id, params)`, вернуть JSON 200, 404 или 422
    - `delete/2`: вызвать `Billing.deactivate_plan(id)`, вернуть JSON 200 или 404
    - Все действия требуют аутентификации Creator-а (pipe `:creator_authenticated`)
    - _Требования: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 8. API контроллеры — End User (планы и подписки)
  - [x] 8.1 Реализовать `ChatForgeWeb.SubscriptionController`
    - Создать `backend/lib/chatforge_web/controllers/subscription_controller.ex`
    - `plans/2`: вызвать `Billing.list_plans(tenant_id)`, фильтровать `is_active: true`, вернуть JSON 200 (без аутентификации)
    - `create/2`: проверить план (активный, того же тенанта), вызвать `FakePayment.create_checkout_session/2`, вернуть JSON 200 с `checkout_url` или 404
    - `current/2`: вызвать `Billing.get_active_subscription(end_user_id, tenant_id)`, вернуть JSON 200
    - _Требования: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.2 Реализовать `ChatForgeWeb.WebhookController`
    - Создать `backend/lib/chatforge_web/controllers/webhook_controller.ex`
    - `payment/2`: принять `plan_id` и `user_id`, вызвать `Billing.create_subscription/3`, вернуть JSON 200 или 422
    - Без верификации подписи (фейковая реализация)
    - _Требования: 4.3, 4.4, 4.5, 4.6_

- [x] 9. Обновление роутера
  - [x] 9.1 Добавить маршруты Billing в `backend/lib/chatforge_web/router.ex`
    - Добавить `resources "/plans"` в scope `/api/v1/dashboard` с pipe `:creator_authenticated`
    - Добавить `get "/plans"` в scope `/api/v1/chat` с pipe `:chat_tenant` (без аутентификации)
    - Добавить `post "/subscriptions"` и `get "/subscriptions/current"` в scope `/api/v1/chat` с pipe `:authenticated`
    - Добавить `post "/payment"` в scope `/api/v1/webhooks` без аутентификации
    - _Требования: 5.1–5.8, 6.1–6.7, 4.3–4.6_

- [x] 10. Frontend — типы, API, Store
  - [x] 10.1 Создать `frontend/src/features/billing/types.ts`
    - Типы: `SubscriptionPlan`, `Subscription`, `CheckoutResponse`
    - `message_limit: number | null` (null = безлимит)
    - _Требования: 8.1–8.9, 9.1–9.6, 11.1–11.4_

  - [x] 10.2 Создать `frontend/src/features/billing/api.ts`
    - Creator API: `getPlans`, `createPlan`, `updatePlan`, `deactivatePlan`
    - End User API: `getPublicPlans`, `startSubscription`, `getCurrentSubscription`
    - Webhook: `confirmPayment`
    - Использовать существующий Axios-клиент из `shared/lib`
    - _Требования: 8.1–8.9, 9.1–9.6, 10.1–10.6, 11.1–11.4_

  - [x] 10.3 Создать `frontend/src/features/billing/billingStore.ts`
    - Zustand store с состоянием: `plans`, `plansLoading`, `currentSubscription`, `subscriptionLoading`, `publicPlans`, `publicPlansLoading`, `paywallOpen`
    - Методы: `fetchPlans`, `fetchPublicPlans`, `fetchCurrentSubscription`, `openPaywall`, `closePaywall`
    - _Требования: 8.1–8.9, 9.1–9.6, 11.1–11.4_

- [x] 11. Frontend — страница управления планами (Creator)
  - [x] 11.1 Создать `frontend/src/pages/dashboard/plans/DashboardPlansPage.tsx`
    - При монтировании: `billingStore.fetchPlans()`
    - Список планов: название, цена, период, лимит (или "Безлимит"), статус активности
    - Пустое состояние: "Создайте первый тарифный план"
    - Форма создания: поля `name`, `price`, `period` (select), `message_limit` (необязательное)
    - Кнопка "Редактировать" → форма редактирования с предзаполненными данными
    - Кнопка "Деактивировать" → подтверждение → `deactivatePlan(id)`
    - Skeleton-загрузчик пока данные загружаются
    - Toast через Sonner при ошибках API
    - _Требования: 8.1–8.9_

  - [x] 11.2 Добавить вкладку "Планы" в `frontend/src/features/dashboard/DashboardPage.tsx`
    - Добавить новую вкладку "Планы" в существующий tab-компонент дашборда
    - При активации вкладки рендерить `<DashboardPlansPage />`
    - _Требования: 8.1_

- [x] 12. Frontend — компонент Paywall
  - [x] 12.1 Создать `frontend/src/shared/ui/Paywall.tsx`
    - Модальное окно (shadcn/ui Dialog или Sheet)
    - При открытии: `billingStore.fetchPublicPlans()`
    - Список планов: название, цена/период, лимит (или "Безлимит"), кнопка "Оформить"
    - Клик "Оформить" → `startSubscription(planId)` → `window.location.href = checkout_url`
    - Skeleton-загрузчик пока планы загружаются
    - Сообщение об ошибке если загрузка планов упала
    - _Требования: 9.1–9.6_

  - [x] 12.2 Интегрировать Paywall в `frontend/src/pages/chat/conversation/ConversationPage.tsx`
    - Подписаться на событие `limit_reached` из `useChat` хука
    - При `limit_reached`: `billingStore.openPaywall()`
    - Рендерить `<Paywall />` когда `paywallOpen == true`
    - Блокировать поле ввода когда `paywallOpen == true`
    - _Требования: 9.1, 9.4_

- [x] 13. Frontend — страницы результата оплаты
  - [x] 13.1 Создать `frontend/src/pages/chat/subscription/SubscriptionSuccessPage.tsx`
    - При монтировании: прочитать `plan_id` и `user_id` из `useSearchParams()`
    - Вызвать `confirmPayment(planId, userId)` → `POST /api/v1/webhooks/payment`
    - При успехе: сообщение "Подписка оформлена" + кнопка "Вернуться в чат" → navigate `/chat`
    - При ошибке: сообщение об ошибке + кнопка "Попробовать снова" → повторить вызов
    - _Требования: 10.1, 10.2, 10.3, 10.4_

  - [x] 13.2 Создать `frontend/src/pages/chat/subscription/SubscriptionCancelPage.tsx`
    - Отобразить сообщение "Оплата отменена"
    - Кнопка "Вернуться в чат" → navigate `/chat`
    - _Требования: 10.5, 10.6_

  - [x] 13.3 Добавить маршруты в роутер фронтенда
    - Добавить `/chat/subscription/success` → `<SubscriptionSuccessPage />`
    - Добавить `/chat/subscription/cancel` → `<SubscriptionCancelPage />`
    - _Требования: 10.1, 10.5_

- [x] 14. Frontend — статус подписки в ConversationPage
  - [x] 14.1 Добавить блок статуса подписки в сайдбар `ConversationPage.tsx`
    - При монтировании: `billingStore.fetchCurrentSubscription()`
    - Если активная подписка: название плана, дата истечения, оставшийся лимит (если `message_limit != null`)
    - Если нет подписки: количество использованных сообщений из бесплатного лимита
    - Skeleton-загрузчик пока данные загружаются
    - _Требования: 11.1, 11.2, 11.3, 11.4_
