# Phase 6 — TESTS

## Бэкенд

- [x] `mix compile --warnings-as-errors` — без ошибок и предупреждений
- [x] Analytics.EventHandler стартует в supervision tree (в application.ex)
- [x] Все `handle_info` clauses имеют `@impl true`
- [x] Analytics не обращается к Billing-схемам напрямую — делегирует через публичный API
- [x] Billing имеет публичные функции `active_subscriptions_count/1`, `revenue_since/2`, `daily_revenue_since/2`
- [x] `DashboardController.settings_json/1` включает `system_prompt`
- [ ] `GET /api/v1/dashboard/analytics/overview` — возвращает 200 с полями `total_users`, `total_messages`, `active_subscriptions`, `revenue`, `conversion_rate`
- [ ] `GET /api/v1/dashboard/analytics/messages?period=30d` — возвращает массив `[{date, count}]`
- [ ] `GET /api/v1/dashboard/analytics/messages?period=invalid` — возвращает 422
- [ ] `GET /api/v1/dashboard/analytics/messages` (без period) — возвращает 422
- [ ] После отправки сообщения в чате — событие `message_sent` появляется в таблице `events`
- [ ] После регистрации end_user — событие `user_registered` появляется в таблице `events`
- [ ] Данные аналитики изолированы по tenant_id (Creator A не видит данные Creator B)

## Frontend

- [x] `tsc --noEmit` — без ошибок
- [x] `InstanceSettings` тип включает `system_prompt`
- [x] `UpdateSettingsPayload` включает `system_prompt`
- [ ] `/dashboard` — отображает 4 карточки метрик и прогресс-бар конверсии
- [ ] `/dashboard` — при ошибке загрузки показывает error state
- [ ] `/dashboard/analytics` — отображает 3 графика, переключатель периода работает
- [ ] `/dashboard/analytics` — при ошибке загрузки показывает error state с кнопкой retry
- [ ] `/dashboard/settings` — форма загружает текущие настройки включая system_prompt
- [ ] `/dashboard/settings` — кнопка "Сохранить" отправляет данные включая system_prompt, toast-уведомление появляется
- [ ] `/dashboard/settings` — превью обновляется в реальном времени
- [ ] `/dashboard/plans` — страница тарифов работает как раньше
- [ ] Sidebar навигация — активный пункт выделен
- [ ] Мобильный вид — hamburger открывает sidebar, overlay закрывает его
- [ ] Хлебные крошки — отображают текущий раздел
- [ ] Неавторизованный пользователь на `/dashboard` — редирект на `/login`
