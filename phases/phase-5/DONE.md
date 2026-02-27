# Phase 5 — DONE

## Что реализовано

### Бэкенд

**Миграции и схемы**
- Таблица `subscription_plans`: id, chat_instance_id, name, price, period, message_limit, is_active
- Таблица `subscriptions`: id, chat_instance_id, end_user_id, plan_id, status, starts_at, expires_at
- Ecto-схемы `SubscriptionPlan` и `Subscription` с changesets и валидацией

**Billing контекст** (`ChatForge.Billing`)
- `create_plan/2`, `list_plans/1`, `update_plan/2`, `deactivate_plan/1`
- `create_subscription/3` — вычисляет expires_at (monthly: +30 дней, yearly: +365 дней)
- `get_active_subscription/2` — возвращает активную подписку с предзагруженным планом
- `ExpireSubscriptionsJob` (Oban cron, ежедневно) — переводит истёкшие подписки в `expired`
- `FakePayment.create_checkout_session/2` — возвращает URL на страницу success

**API**
- `PlanController` — CRUD планов для Creator (требует аутентификации)
- `SubscriptionController` — публичный список планов, создание подписки, текущая подписка
- `WebhookController` — подтверждение оплаты (`POST /api/v1/webhooks/payment`)
- Все маршруты добавлены в роутер

**Chat контекст**
- `check_limit/2` расширен: приоритет активной подписки над бесплатным лимитом
- Безлимитный доступ при `message_limit: nil`

### Фронтенд

**Billing feature** (`frontend/src/features/billing/`)
- `types.ts` — `SubscriptionPlan`, `Subscription`, `CheckoutResponse`
- `api.ts` — все API-функции (Creator + End User + Webhook)
- `billingStore.ts` — Zustand store с состоянием планов, подписки, paywall

**Страницы Creator**
- `DashboardPlansPage` — список планов, форма создания/редактирования, деактивация
- Вкладка "Планы" добавлена в `DashboardPage`

**Компоненты End User**
- `Paywall` — модальное окно с планами, открывается при `limit_reached`
- `SubscriptionSuccessPage` — подтверждение оплаты через webhook
- `SubscriptionCancelPage` — страница отмены

**ConversationPage**
- Интеграция Paywall: открывается при `isLimitReached`, блокирует ввод
- Блок статуса подписки в сайдбаре: план, дата истечения, тип лимита
- Маршруты `/chat/subscription/success` и `/chat/subscription/cancel` добавлены в роутер

---

## Ограничения реализации

- Платёжная система — **фейковая** (FakePayment), без реальной интеграции со Stripe/ЮKassa
- Верификация подписи webhook не реализована
- Обработка отмены/возврата через webhook не реализована

---

## Исправления (post-review)

- `PlanController.update/2` — проверка принадлежности плана тенанту перенесена ДО обновления в БД (устранён race condition)
- `SubscriptionController.plans/2` — убрано поле `is_active` из публичного ответа
- `Paywall.tsx` — добавлено отображение ошибки при неудачном `startSubscription` и при ошибке загрузки планов (требование 9.6)
- `ConversationPage` — блок бесплатного плана в сайдбаре теперь показывает `messages_used` (требование 11.3)

---

## Что не входило в фазу

- Реферальная программа
- Промокоды и скидки
- Возвраты через UI
