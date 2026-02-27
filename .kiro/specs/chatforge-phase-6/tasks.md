# Tasks — Phase 6: Дашборд Creator-а и аналитика

## Задачи

- [x] 1. Analytics контекст — схема и трекинг
  - [x] 1.1 Создать миграцию таблицы `events` (id, chat_instance_id, event_type, payload JSONB, inserted_at)
  - [x] 1.2 Создать схему `ChatForge.Analytics.Event` с changeset
  - [x] 1.3 Реализовать `Analytics.track/3` — сохранение события в БД
  - [x] 1.4 Создать `Analytics.EventHandler` (GenServer) — подписка на PubSub-события и вызов `track/3`
  - [x] 1.5 Добавить `EventHandler` в supervision tree приложения
  - [x] 1.6 Убедиться что Chat контекст публикует `message.sent` событие в PubSub (добавить если отсутствует)

- [x] 2. Analytics контекст — агрегация метрик
  - [x] 2.1 Реализовать `Analytics.total_users/1`
  - [x] 2.2 Реализовать `Analytics.total_messages/2` с поддержкой периодов `:day_7`, `:day_30`, `:day_90`
  - [x] 2.3 Реализовать `Analytics.total_conversations/2`
  - [x] 2.4 Реализовать `Analytics.active_subscriptions/1` (через `Billing` публичный API)
  - [x] 2.5 Реализовать `Analytics.revenue/2` (через `Billing` публичный API)
  - [x] 2.6 Реализовать `Analytics.conversion_rate/1`
  - [x] 2.7 Реализовать `Analytics.daily_stats/3` — метрики по дням для графиков

- [x] 3. Analytics API контроллер
  - [x] 3.1 Создать `AnalyticsController` с экшенами `overview/2`, `messages/2`, `users/2`, `revenue/2`
  - [x] 3.2 Добавить роуты в `router.ex` в scope `/api/v1/dashboard`
  - [x] 3.3 Добавить валидацию параметра `period` (7d|30d|90d), возвращать 422 при неверном значении

- [x] 4. Frontend — дашборд (обзор)
  - [x] 4.1 Установить `recharts` в frontend (`npm install recharts`)
  - [x] 4.2 Создать `analyticsApi.ts` с функциями `overview`, `messages`, `users`, `revenue`
  - [x] 4.3 Создать компонент `StatCard` (число + лейбл + skeleton)
  - [x] 4.4 Создать компонент `PeriodSelector` (кнопки 7д / 30д / 90д)
  - [x] 4.5 Создать `DashboardOverviewPage.tsx` — карточки + конверсия
  - [x] 4.6 Создать `DashboardAnalyticsPage.tsx` — три графика с переключателем периода

- [x] 5. Frontend — редактор настроек
  - [x] 5.1 Создать `DashboardSettingsPage.tsx` с тремя секциями (Внешний вид, Контент, AI)
  - [x] 5.2 Реализовать мини-превью чата справа, обновляющееся при изменении полей формы
  - [x] 5.3 Подключить сохранение через существующий API настроек инстанса

- [x] 6. Frontend — навигация дашборда
  - [x] 6.1 Создать `DashboardLayout.tsx` с sidebar-навигацией (Обзор, Аналитика, Настройки, Тарифы)
  - [x] 6.2 Добавить мобильную адаптацию sidebar (hamburger + overlay)
  - [x] 6.3 Добавить компонент `Breadcrumbs` в шапку
  - [x] 6.4 Обновить роутинг в `App.tsx` — обернуть dashboard-страницы в `DashboardLayout`
