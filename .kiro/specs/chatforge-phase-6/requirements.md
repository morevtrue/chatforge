# Requirements — Phase 6: Дашборд Creator-а и аналитика

## Введение

Фаза 6 добавляет полноценный дашборд для Creator-а: аналитику по пользователям, сообщениям, подпискам и доходу, а также расширенный редактор настроек чата с превью в реальном времени.

## Требования

### 1. Сбор аналитических событий (Analytics контекст)

**User Story:** Как система, я должна фиксировать ключевые события, чтобы Creator мог видеть аналитику своего чата.

#### Acceptance Criteria

1.1. Схема `ChatForge.Analytics.Event` содержит поля: `id`, `chat_instance_id`, `event_type`, `payload` (JSONB), `inserted_at`.

1.2. Функция `Analytics.track/3` принимает `(event_type, chat_instance_id, payload)` и сохраняет событие в БД. При `chat_instance_id = nil` событие сохраняется без привязки к тенанту.

1.3. Analytics-модуль подписывается на PubSub-события при старте приложения:
- `user.registered` → тип события `"user_registered"`
- `message.sent` → тип события `"message_sent"`
- `subscription.created` → тип события `"subscription_created"`
- `subscription.expired` → тип события `"subscription_expired"`
- `instance.created` → тип события `"instance_created"`

1.4. Каждое полученное PubSub-событие вызывает `Analytics.track/3` с соответствующим типом и payload.

---

### 2. Агрегация метрик

**User Story:** Как Creator, я хочу видеть агрегированные метрики своего чата.

#### Acceptance Criteria

2.1. `Analytics.total_users/1` возвращает общее количество `end_users` для данного `chat_instance_id`.

2.2. `Analytics.total_messages/2` принимает `(chat_instance_id, period)` и возвращает количество событий `"message_sent"` за указанный период (`:day_7`, `:day_30`, `:day_90`).

2.3. `Analytics.total_conversations/2` принимает `(chat_instance_id, period)` и возвращает количество уникальных `conversation_id` из событий `"message_sent"` за период.

2.4. `Analytics.active_subscriptions/1` возвращает количество активных подписок (status = "active", expires_at > now) для тенанта. Данные берутся из таблицы `subscriptions` через публичный API Billing контекста.

2.5. `Analytics.revenue/2` принимает `(chat_instance_id, period)` и возвращает сумму `price` из `subscription_plans` для подписок, созданных за период. Данные берутся через события `"subscription_created"` или напрямую из Billing.

2.6. `Analytics.conversion_rate/1` возвращает процент пользователей с активной подпиской от общего числа пользователей. Формула: `(active_subscriptions / total_users) * 100`. Возвращает `0.0` если `total_users = 0`.

2.7. `Analytics.daily_stats/2` принимает `(chat_instance_id, period)` и возвращает список `%{date, messages, new_users, revenue}` по дням за период.

---

### 3. API аналитики для Creator-а

**User Story:** Как Creator, я хочу получать данные аналитики через API.

#### Acceptance Criteria

3.1. `GET /api/v1/dashboard/analytics/overview` возвращает JSON с полями: `total_users`, `total_messages`, `active_subscriptions`, `revenue`, `conversion_rate`. Требует аутентификации Creator-а.

3.2. `GET /api/v1/dashboard/analytics/messages?period=7d|30d|90d` возвращает массив `[{date, count}]` по дням. Параметр `period` обязателен, допустимые значения: `7d`, `30d`, `90d`. При неверном значении — 422.

3.3. `GET /api/v1/dashboard/analytics/users?period=7d|30d|90d` возвращает массив `[{date, count}]` новых регистраций по дням.

3.4. `GET /api/v1/dashboard/analytics/revenue?period=7d|30d|90d` возвращает массив `[{date, amount}]` дохода по дням.

3.5. Все эндпоинты защищены middleware аутентификации Creator-а. Данные изолированы по `chat_instance_id` из JWT-токена.

---

### 4. Frontend — дашборд Creator-а

**User Story:** Как Creator, я хочу видеть наглядный дашборд с ключевыми метриками своего чата.

#### Acceptance Criteria

4.1. Страница `/dashboard` отображает 4 сводные карточки: "Пользователи", "Сообщения", "Подписки", "Доход".

4.2. На странице есть переключатель периода: 7 дней / 30 дней / 90 дней. При смене периода данные перезагружаются.

4.3. Отображается график сообщений по дням (библиотека `recharts`, тип `LineChart` или `AreaChart`).

4.4. Отображается график регистраций по дням.

4.5. Отображается график дохода по дням.

4.6. Отображается карточка конверсии: "X% пользователей перешли на платный план".

4.7. Во время загрузки данных отображаются skeleton-заглушки. При ошибке — сообщение об ошибке.

---

### 5. Frontend — редактор настроек чата

**User Story:** Как Creator, я хочу редактировать настройки своего чата в удобном интерфейсе с превью.

#### Acceptance Criteria

5.1. Страница `/dashboard/settings` содержит секцию "Внешний вид": поля для `primary_color`, `secondary_color`, `background_color`, загрузка аватара.

5.2. Секция "Контент": поле `greeting_text`, редактор `example_questions` (добавление/удаление строк).

5.3. Секция "AI": textarea для `system_prompt`.

5.4. Кнопка "Сохранить" отправляет изменения на бэкенд. При успехе — toast-уведомление. При ошибке — сообщение об ошибке.

5.5. Справа от формы отображается мини-превью чата, обновляющееся в реальном времени при изменении полей формы.

---

### 6. Frontend — навигация дашборда

**User Story:** Как Creator, я хочу удобно перемещаться между разделами дашборда.

#### Acceptance Criteria

6.1. Sidebar содержит разделы: "Обзор" (`/dashboard`), "Аналитика" (`/dashboard/analytics`), "Настройки" (`/dashboard/settings`), "Тарифы" (`/dashboard/plans`).

6.2. Активный раздел визуально выделен в sidebar.

6.3. На мобильных устройствах sidebar скрыт, доступен через hamburger-кнопку.

6.4. Хлебные крошки отображаются в шапке страницы.
