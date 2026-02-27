# Phase 6 — DONE

## Что реализовано

### Backend

**Analytics контекст** (`backend/lib/chatforge/analytics/`):
- Схема `ChatForge.Analytics.Event` — append-only лог событий с JSONB payload
- `Analytics.track/3` — сохранение события в БД
- `Analytics.EventHandler` (GenServer) — подписка на PubSub-топики и запись событий (все clauses с `@impl true`)
- EventHandler добавлен в supervision tree приложения
- Агрегирующие функции: `total_users/1`, `total_messages/2`, `total_conversations/2`, `active_subscriptions/1`, `revenue/2`, `conversion_rate/1`, `daily_stats/3`, `daily_revenue/2`
- `active_subscriptions/1`, `revenue/2`, `daily_revenue/2` — делегируют в Billing через публичный API (не обращаются к Billing-схемам напрямую)

**Billing контекст** — добавлены публичные функции для Analytics:
- `Billing.active_subscriptions_count/1` — количество активных подписок тенанта
- `Billing.revenue_since/2` — суммарный доход за период
- `Billing.daily_revenue_since/2` — доход по дням за период

**Chat контекст** — добавлена публикация событий:
- `register_end_user` публикует `{:user_registered, ...}` в топик `"accounts:users"`
- `send_message` публикует `{:message_sent, ...}` в глобальный топик `"chat:messages"` (дополнительно к топику диалога)

**API** (`backend/lib/chatforge_web/controllers/analytics_controller.ex`):
- `GET /api/v1/dashboard/analytics/overview` — сводка метрик
- `GET /api/v1/dashboard/analytics/messages?period=7d|30d|90d`
- `GET /api/v1/dashboard/analytics/users?period=7d|30d|90d`
- `GET /api/v1/dashboard/analytics/revenue?period=7d|30d|90d`
- Валидация параметра `period`, 422 при неверном значении или отсутствии

**DashboardController** — обновлён:
- `settings_json/1` теперь включает `system_prompt` в ответ API

### Frontend

**API-клиент** (`frontend/src/features/dashboard/analyticsApi.ts`):
- Типизированные функции `overview`, `messages`, `users`, `revenue`

**API-клиент** (`frontend/src/features/dashboard/api.ts`):
- `UpdateSettingsPayload` включает `system_prompt`

**Типы** (`frontend/src/features/builder/types.ts`):
- `InstanceSettings` включает `system_prompt: string | null`

**Компоненты** (`frontend/src/features/dashboard/components/`):
- `StatCard` — карточка метрики со skeleton-состоянием
- `PeriodSelector` — переключатель 7д / 30д / 90д

**Страницы** (`frontend/src/pages/dashboard/`):
- `overview/DashboardOverviewPage.tsx` — 4 карточки + прогресс-бар конверсии + error state
- `analytics/DashboardAnalyticsPage.tsx` — 3 AreaChart (recharts) с переключателем периода + error state с retry
- `settings/DashboardSettingsPage.tsx` — форма с 3 секциями + мини-превью чата в реальном времени + system_prompt загружается и сохраняется
- `DashboardLayout.tsx` — sidebar с навигацией, хлебные крошки, мобильный hamburger

**Роутинг** (`frontend/src/app/App.tsx`):
- `/dashboard` → `DashboardOverviewPage`
- `/dashboard/analytics` → `DashboardAnalyticsPage`
- `/dashboard/settings` → `DashboardSettingsPage`
- `/dashboard/plans` → `DashboardPlansPage` (существовала с фазы 5)

## Исправления после QA-ревью

1. **Analytics → Billing архитектурные границы** — `active_subscriptions`, `revenue`, `daily_revenue` теперь делегируют в Billing через публичный API вместо прямого доступа к Billing-схемам
2. **EventHandler `@impl true`** — добавлен на все clauses `handle_info/2`
3. **system_prompt** — добавлен в `settings_json`, `InstanceSettings` тип, `UpdateSettingsPayload`, загрузка и сохранение в DashboardSettingsPage
4. **Обработка ошибок в Analytics page** — добавлен error state с кнопкой retry

## Ограничения

- Аналитика считается по событиям в таблице `events` — исторические данные до запуска EventHandler не учитываются
- `total_conversations` считает уникальные `conversation_id` из payload событий — требует что payload содержит это поле
- Валюта в карточках дохода и графиках захардкожена как `₽` — в будущем нужно брать из `instance.currency`

## Что не входило

- Экспорт данных в CSV/Excel
- Email-уведомления Creator-у
- Детальная аналитика по конкретным пользователям
