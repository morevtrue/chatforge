# Phase 5 — Подписки и монетизация

**Название фазы:** Billing — тарифные планы, подписки, paywall
**Статус:** ✅ Завершена

---

## Цель фазы

Creator создаёт тарифные планы. End User видит paywall при исчерпании лимита и оформляет подписку.
После этой фазы — монетизация работает end-to-end.

---

## Задачи

### 5.1 Billing контекст — Ecto-схемы
- [x] Схема `ChatForge.Billing.SubscriptionPlan`
- [x] Схема `ChatForge.Billing.Subscription`
- [x] Changesets с валидацией (цена > 0, период: `monthly` | `yearly`)

### 5.2 Billing контекст — бизнес-логика планов
- [x] `Billing.create_plan/2` — создать тарифный план для инстанса
- [x] `Billing.list_plans/1` — список планов инстанса (tenant-scoped)
- [x] `Billing.update_plan/2` — обновить план
- [x] `Billing.deactivate_plan/1` — деактивировать план (не удалять, у пользователей могут быть активные подписки)
- [x] Валидация: нельзя создать план с ценой 0 (для бесплатного доступа — лимит сообщений)

### 5.3 Billing контекст — бизнес-логика подписок
- [x] `Billing.get_active_subscription/2` — получить активную подписку end_user в рамках tenant
- [x] `Billing.create_subscription/3` — создать подписку после успешной оплаты
- [x] `Billing.expire_subscriptions/0` — Oban job: ежедневно деактивировать истёкшие подписки
- [x] Публикация события `subscription.created` через PubSub
- [x] Публикация события `subscription.expired` через PubSub

### 5.4 Billing — интеграция с платёжной системой
- [x] Фейковая реализация `FakePayment.create_checkout_session/2` (без реальной платёжной системы)
- [x] Webhook handler: `POST /api/v1/webhooks/payment` — обработать событие успешной оплаты
- [ ] Webhook handler: обработать событие отмены/возврата
- [ ] Верификация подписи webhook (не требуется для фейковой реализации)

### 5.5 Billing — API контроллер (Creator)
- [x] `GET /api/v1/dashboard/plans` — список тарифных планов инстанса
- [x] `POST /api/v1/dashboard/plans` — создать план
- [x] `PUT /api/v1/dashboard/plans/:id` — обновить план
- [x] `DELETE /api/v1/dashboard/plans/:id` — деактивировать план

### 5.6 Billing — API контроллер (End User)
- [x] `GET /api/v1/chat/plans` — публичный список планов инстанса (tenant-scoped)
- [x] `POST /api/v1/chat/subscriptions` — начать оформление подписки (создать checkout session)
- [x] `GET /api/v1/chat/subscriptions/current` — текущая подписка пользователя

### 5.7 Chat — обновление логики лимитов
- [x] `Chat.check_limit/2` — учитывать активную подписку (если есть — использовать лимит плана)
- [x] Если подписка с `message_limit: nil` — безлимитный доступ
- [x] Событие `limit.reached` → Channel отправляет `limit_reached` клиенту

### 5.8 Frontend — управление планами (Creator, дашборд)
- [x] Страница `DashboardPlansPage` — список тарифных планов (вкладка в дашборде)
- [x] Форма создания плана: название, цена, период, лимит сообщений (или "безлимит")
- [x] Редактирование и деактивация плана
- [x] Пустое состояние: "Создайте первый тарифный план"

### 5.9 Frontend — paywall (End User)
- [x] Компонент `<Paywall />` — модальное окно при исчерпании лимита
- [x] Отображение доступных тарифных планов с ценами
- [x] Кнопка "Оформить подписку" → редирект на checkout
- [x] Страница `/chat/subscription/success` — подтверждение оплаты
- [x] Страница `/chat/subscription/cancel` — отмена оплаты

### 5.10 Frontend — статус подписки (End User)
- [x] В сайдбаре ConversationPage: текущий план, дата истечения
- [x] Индикатор безлимита или лимита сообщений
- [x] Skeleton-загрузчик

---

## Ограничения

- НЕ входит: реферальная программа.
- НЕ входит: промокоды и скидки.
- НЕ входит: возвраты через UI (только через платёжную систему напрямую).

---

## Ссылки

- Архитектура: `sources-of-truth/ARCHITECTURE.md`
- Бизнес-логика: `sources-of-truth/BUSINESS_SPEC.md`
