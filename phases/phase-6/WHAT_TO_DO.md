# Phase 6 — Дашборд Creator-а и аналитика

**Название фазы:** Analytics — метрики, отчёты, дашборд Creator-а
**Статус:** ✅ Завершена

---

## Цель фазы

Creator видит полную картину своего чата: пользователи, сообщения, подписки, доход.
После этой фазы — дашборд информативен и помогает принимать решения.

---

## Задачи

### 6.1 Analytics контекст — сбор событий
- [ ] Схема `ChatForge.Analytics.Event`
- [ ] `Analytics.track/3` — сохранить событие (`event_type`, `chat_instance_id`, `payload`)
- [ ] Подписаться на PubSub-события: `user.registered`, `message.sent`, `subscription.created`, `subscription.expired`, `instance.created`
- [ ] Обработчик каждого события → вызов `Analytics.track/3`

### 6.2 Analytics контекст — агрегация метрик
- [ ] `Analytics.total_users/1` — общее количество end_users инстанса
- [ ] `Analytics.total_messages/2` — количество сообщений за период
- [ ] `Analytics.total_conversations/2` — количество диалогов за период
- [ ] `Analytics.active_subscriptions/1` — количество активных подписок
- [ ] `Analytics.revenue/2` — доход за период (из таблицы payments)
- [ ] `Analytics.conversion_rate/1` — конверсия из бесплатных в платных (%)
- [ ] `Analytics.daily_stats/2` — метрики по дням за период (для графика)

### 6.3 Analytics — API контроллер (Creator)
- [ ] `GET /api/v1/dashboard/analytics/overview` — сводка: пользователи, сообщения, подписки, доход
- [ ] `GET /api/v1/dashboard/analytics/messages?period=7d|30d|90d` — динамика сообщений
- [ ] `GET /api/v1/dashboard/analytics/users?period=7d|30d|90d` — динамика регистраций
- [ ] `GET /api/v1/dashboard/analytics/revenue?period=7d|30d|90d` — динамика дохода

### 6.4 Frontend — дашборд Creator-а (полный)
- [ ] Страница `/dashboard` — сводные карточки: пользователи, сообщения, подписки, доход
- [ ] График сообщений по дням (библиотека `recharts`)
- [ ] График регистраций по дням
- [ ] График дохода по дням
- [ ] Переключатель периода: 7 дней / 30 дней / 90 дней
- [ ] Карточка конверсии: бесплатные → платные (%)
- [ ] Состояние загрузки (skeleton) и ошибки

### 6.5 Frontend — настройки чата (полный редактор)
- [ ] Страница `/dashboard/settings` — редактирование всех настроек инстанса
- [ ] Секция "Внешний вид": цвета, аватар (с превью)
- [ ] Секция "Контент": приветствие, примеры вопросов
- [ ] Секция "AI": system prompt (textarea)
- [ ] Кнопка "Сохранить" с оптимистичным обновлением
- [ ] Превью чата в реальном времени (мини-виджет справа)

### 6.6 Frontend — навигация дашборда
- [ ] Sidebar с разделами: Обзор, Аналитика, Настройки, Тарифы
- [ ] Хлебные крошки
- [ ] Мобильная адаптация (hamburger menu)

---

## Ограничения

- НЕ входит: экспорт данных в CSV/Excel.
- НЕ входит: email-уведомления Creator-у.
- НЕ входит: детальная аналитика по конкретным пользователям.

---

## Ссылки

- Архитектура: `sources-of-truth/ARCHITECTURE.md`
- Бизнес-логика: `sources-of-truth/BUSINESS_SPEC.md`
