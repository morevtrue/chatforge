# ARCHITECTURE — Архитектура системы ChatForge

## Назначение документа

Описывает:
- какие контексты (модули) существуют и за что отвечают;
- как контексты взаимодействуют друг с другом;
- где хранятся данные;
- какие правила нельзя нарушать.

Этот файл — **контракт** между командой и ИИ-инструментами.
Не переписывается без архитектурного решения.

---

## Архитектурные принципы

### Modular Monolith
- Единое Elixir-приложение с чёткими bounded contexts.
- Каждый контекст — отдельная папка в `lib/chatforge/`.
- Контексты общаются через публичные функции и PubSub-события.
- Контексты НЕ лезут в Ecto-схемы друг друга напрямую.

### Разделение ответственности
- Каждый контекст — отдельная зона ответственности.
- Свои Ecto-схемы и миграции.
- Независимая бизнес-логика.

### Асинхронное взаимодействие
- Контексты не вызывают друг друга напрямую там, где можно через события.
- Все ключевые действия порождают события через Phoenix.PubSub.
- Фоновые задачи — через Oban.
- События — источник аналитики и автоматизации.

### Изоляция данных (Multi-tenancy)
- Полная изоляция данных по `tenant_id` (= chat_instance_id).
- Ни один запрос к БД не выполняется без фильтра по `tenant_id`.
- `tenant_id` резолвится из поддомена запроса (Plug).
- Два уровня изоляции:
  - Уровень платформы: Creator видит только свои Chat Instances.
  - Уровень инстанса: конечный пользователь видит только данные своего чата.

### API-first
- Все функции доступны через REST API.
- Frontend — просто клиент.
- Real-time — через Phoenix Channels.
- Возможность подключать любые клиенты (Web / Mobile / External).

---

## Общая схема (логическая)

```
┌─────────────────────────────────────────────────────────┐
│                    КЛИЕНТЫ                               │
│  [ Platform SPA ]          [ Chat Instance SPA ]         │
│  (Creator: визард,         (End User: диалоги,           │
│   дашборд, настройки)       подписки, AI-чат)            │
└──────────┬─────────────────────────┬────────────────────┘
           │                         │
     ┌─────┴─────────────────────────┴─────┐
     │            TRAEFIK                   │
     │  (reverse proxy, SSL, поддомены,     │
     │   auto-discovery, Let's Encrypt)     │
     └─────────────────┬───────────────────┘
                       │
     ┌─────────────────┴───────────────────┐
     │        PHOENIX APPLICATION           │
     │                                      │
     │  ┌──────────┐  ┌──────────────────┐ │
     │  │  Router   │  │    Channels      │ │
     │  │  (REST)   │  │  (WebSocket)     │ │
     │  └────┬─────┘  └───────┬──────────┘ │
     │       │                 │            │
     │  ┌────┴─────────────────┴──────────┐│
     │  │           PLUGS                  ││
     │  │  (Auth, TenantResolver,          ││
     │  │   RateLimit, CORS)               ││
     │  └────┬─────────────────────────────┘│
     │       │                              │
     │  ┌────┴──────────────────────────┐  │
     │  │      BOUNDED CONTEXTS          │  │
     │  │                                │  │
     │  │  ┌──────────┐ ┌────────────┐  │  │
     │  │  │ Accounts │ │ Instances  │  │  │
     │  │  └──────────┘ └────────────┘  │  │
     │  │  ┌──────────┐ ┌────────────┐  │  │
     │  │  │   Chat   │ │  Billing   │  │  │
     │  │  └──────────┘ └────────────┘  │  │
     │  │  ┌──────────┐ ┌────────────┐  │  │
     │  │  │    AI    │ │ Analytics  │  │  │
     │  │  └──────────┘ └────────────┘  │  │
     │  │  ┌──────────┐                 │  │
     │  │  │  Admin   │                 │  │
     │  │  └──────────┘                 │  │
     │  └───────────────────────────────┘  │
     │                                      │
     │  ┌───────────────────────────────┐  │
     │  │  Phoenix.PubSub + Oban        │  │
     │  │  (события + фоновые задачи)   │  │
     │  └───────────────────────────────┘  │
     └──────────────────┬──────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
   ┌──────┴──┐   ┌─────┴────┐  ┌────┴─────┐
   │PostgreSQL│   │  Redis   │  │  S3/MinIO│
   │  (данные)│   │(кеш,сесс)│  │ (файлы)  │
   └─────────┘   └──────────┘  └──────────┘
```

---

## Bounded Contexts (контексты)

### Accounts
- **Зона:** регистрация, аутентификация, профили Creator-ов.
- **Ecto-схемы:** `User`, `Session`.
- **Ключевые функции:**
  - Регистрация Creator-а (email, пароль, имя, телефон, Telegram).
  - Логин / логаут (JWT: access + refresh).
  - Управление профилем.
- **Публикует события:** `user.registered`, `user.logged_in`.
- **Не делает:** не знает про Chat Instances, подписки, AI.

### Instances
- **Зона:** Chat Instance (тенанты), настройки, визард создания.
- **Ecto-схемы:** `ChatInstance`, `InstanceSettings`, `WizardState`.
- **Ключевые функции:**
  - Создание Chat Instance через визард (4 шага).
  - Хранение настроек: цвета, название, аватар, приветствие, примеры вопросов.
  - Резолвинг тенанта по поддомену.
  - Управление настройками после создания.
- **Публикует события:** `instance.created`, `instance.settings_updated`.
- **Зависит от:** Accounts (creator_id).

### Chat
- **Зона:** диалоги, сообщения, лимиты сообщений.
- **Ecto-схемы:** `Conversation`, `Message`, `EndUser`.
- **Ключевые функции:**
  - Регистрация / аутентификация конечных пользователей (отдельно от Creator-ов).
  - Создание диалогов.
  - Отправка сообщений, получение AI-ответов.
  - Подсчёт использованных сообщений, проверка лимитов.
- **Публикует события:** `message.sent`, `message.received`, `limit.reached`.
- **Зависит от:** Instances (tenant_id), AI (получение ответов).

### Billing
- **Зона:** подписки, тарифные планы, платежи, paywall.
- **Ecto-схемы:** `SubscriptionPlan`, `Subscription`, `Payment`.
- **Ключевые функции:**
  - Создание тарифных планов Creator-ом.
  - Оформление подписки конечным пользователем.
  - Проверка активности подписки.
  - Paywall: блокировка при исчерпании лимита.
  - Интеграция с платёжной системой.
- **Публикует события:** `subscription.created`, `subscription.expired`, `payment.completed`.
- **Зависит от:** Instances (tenant_id), Chat (лимиты).

### AI
- **Зона:** AI Orchestrator — подготовка промптов, вызов AI API, streaming.
- **Ecto-схемы:** `PromptTemplate`, `AIUsageLog`.
- **Ключевые функции:**
  - Подготовка контекста для AI (история диалога, system prompt).
  - Вызов внешних AI API (OpenAI, Anthropic, Google).
  - Streaming ответов через Phoenix Channels.
  - Логирование использования (токены, стоимость).
  - Выбор провайдера/модели через конфигурацию.
- **Публикует события:** `ai.response_completed`, `ai.error`.
- **Не делает:** не хранит бизнес-данные, не изменяет данные напрямую. Stateless.

### Analytics
- **Зона:** сбор событий, метрики, отчёты.
- **Ecto-схемы:** `Event`, `DailyStats`.
- **Ключевые функции:**
  - Подписка на события из PubSub.
  - Агрегация метрик (пользователи, сообщения, подписки, доход).
  - API для дашборда Creator-а.
  - API для дашборда Super Admin-а.
- **Не делает:** не дёргает другие контексты напрямую — только слушает события.

### Admin
- **Зона:** Super Admin, управление платформой.
- **Ecto-схемы:** использует схемы других контекстов через их публичные функции.
- **Ключевые функции:**
  - Просмотр всех Chat Instances.
  - Управление Creator-ами (блокировка, лимиты).
  - Мониторинг использования AI API.
  - Конфигурация платформы.
- **Не делает:** не обходит публичные API контекстов.

---

## Границы ответственности

### ❌ Запрещено:
- Контекстам читать или писать в Ecto-схемы другого контекста напрямую.
- Frontend обращаться к Phoenix минуя Traefik (в production).
- AI контексту изменять бизнес-данные.
- Analytics контексту хранить бизнес-логику.
- Chat контексту вызывать AI API напрямую — только через AI контекст.
- Выполнять запросы к БД без фильтра по tenant_id (кроме Accounts и Admin).

### ✅ Разрешено:
- Взаимодействие через PubSub (async) и публичные функции контекстов (sync).
- Добавление новых контекстов без изменения существующих.
- Горизонтальное масштабирование через кластеризацию Elixir-нод.

---

## Ключевые потоки данных

### Поток 1: Creator создаёт AI-чат (визард)
1. Creator авторизуется → Accounts.
2. Начинает визард → Instances создаёт WizardState.
3. Шаг 1 (цвета) → Instances сохраняет настройки.
4. Шаг 2 (название, валюта) → Instances сохраняет, резервирует поддомен.
5. Шаг 3 (аватар, приветствие) → Instances сохраняет, файл → S3.
6. Шаг 4 (подписки, лимиты) → Billing создаёт тарифные планы.
7. Финализация → Instances создаёт ChatInstance, публикует `instance.created`.
8. Analytics фиксирует событие.

### Поток 2: Конечный пользователь отправляет сообщение
1. End User авторизуется → Chat (отдельная аутентификация).
2. Создаёт или открывает Conversation → Chat.
3. Отправляет сообщение → Chat сохраняет Message.
4. Chat проверяет лимиты → если исчерпаны, возвращает paywall.
5. Chat вызывает AI.complete/3 → AI контекст.
6. AI подготавливает контекст (история + system prompt).
7. AI вызывает внешний API, стримит ответ через Channel.
8. Chat сохраняет AI-ответ как Message.
9. PubSub: `message.sent`, `message.received`.
10. Analytics фиксирует события.

### Поток 3: Конечный пользователь оформляет подписку
1. End User видит paywall → Billing.
2. Выбирает тарифный план → Billing.
3. Перенаправляется на платёжную страницу → внешний провайдер.
4. Webhook от провайдера → Billing подтверждает оплату.
5. Billing создаёт Subscription, публикует `subscription.created`.
6. Chat обновляет лимиты пользователя.
7. Analytics фиксирует событие.

---

## Tenant Resolution (резолвинг тенанта)

Механизм определения текущего Chat Instance по запросу:

1. Запрос приходит на `mybot.chatforge.app`.
2. Traefik проксирует на Phoenix.
3. Plug `TenantResolver` извлекает поддомен из Host header.
4. Ищет ChatInstance по поддомену в БД (с кешем в Redis).
5. Кладёт `tenant_id` в `conn.assigns`.
6. Все последующие запросы к БД фильтруются по этому `tenant_id`.

Для API платформы (Creator):
- Запросы идут на `app.chatforge.app` (или `chatforge.app`).
- Tenant определяется из JWT-токена Creator-а.

---

## Схема базы данных (ключевые таблицы)

```
── Accounts ──────────────────────────
users
  id (UUID, PK)
  email (unique)
  password_hash
  name
  phone
  telegram
  role (super_admin | creator)
  inserted_at, updated_at

── Instances ─────────────────────────
chat_instances
  id (UUID, PK)
  creator_id (FK → users)
  name
  subdomain (unique)
  currency (RUB, USD, EUR...)
  status (draft | active | suspended)
  inserted_at, updated_at

instance_settings
  id (UUID, PK)
  chat_instance_id (FK → chat_instances)
  primary_color
  secondary_color
  background_color
  avatar_url
  greeting_text
  example_questions (JSONB)
  system_prompt (text, опционально)
  inserted_at, updated_at

── Chat ──────────────────────────────
end_users
  id (UUID, PK)
  chat_instance_id (FK → chat_instances)  ← tenant_id
  email
  password_hash
  name
  messages_used (integer, default 0)
  inserted_at, updated_at

conversations
  id (UUID, PK)
  chat_instance_id (FK → chat_instances)  ← tenant_id
  end_user_id (FK → end_users)
  title
  inserted_at, updated_at

messages
  id (UUID, PK)
  conversation_id (FK → conversations)
  chat_instance_id (FK → chat_instances)  ← tenant_id
  role (user | assistant)
  content (text)
  tokens_used (integer)
  inserted_at

── Billing ───────────────────────────
subscription_plans
  id (UUID, PK)
  chat_instance_id (FK → chat_instances)  ← tenant_id
  name
  price (decimal)
  period (monthly | yearly)
  message_limit (integer, nullable = unlimited)
  is_active (boolean)
  inserted_at, updated_at

subscriptions
  id (UUID, PK)
  chat_instance_id (FK → chat_instances)  ← tenant_id
  end_user_id (FK → end_users)
  plan_id (FK → subscription_plans)
  status (active | expired | cancelled)
  starts_at, expires_at
  inserted_at, updated_at

── AI ────────────────────────────────
ai_usage_logs
  id (UUID, PK)
  chat_instance_id (FK → chat_instances)  ← tenant_id
  conversation_id (FK → conversations)
  provider (openai | anthropic | google)
  model
  input_tokens (integer)
  output_tokens (integer)
  cost (decimal)
  inserted_at

── Analytics ─────────────────────────
events
  id (UUID, PK)
  chat_instance_id (FK → chat_instances, nullable)
  event_type (string)
  payload (JSONB)
  inserted_at
```

---

## Стек (сводная таблица)

| Компонент            | Технология                          |
|----------------------|-------------------------------------|
| Backend              | Elixir 1.17+ / Phoenix 1.7+        |
| Frontend             | React 18+ / TypeScript 5+ / Vite   |
| Основное хранилище   | PostgreSQL 16+                      |
| Кеш / сессии         | Redis 7+                            |
| Файлы                | S3-совместимое (MinIO для dev)      |
| Real-time            | Phoenix Channels (WebSocket)        |
| Фоновые задачи       | Oban                                |
| Event Bus            | Phoenix.PubSub                      |
| Edge Router          | Traefik 3+                          |
| CI/CD                | GitHub Actions                      |
| Мониторинг           | Prometheus + Grafana                |
| Контейнеризация      | Docker + Docker Compose             |

---

## Итог

Архитектура ChatForge — модульный монолит на Elixir/Phoenix с 7 bounded contexts,
PostgreSQL как единое хранилище с изоляцией по tenant_id, React SPA как клиент,
и Phoenix Channels для real-time streaming AI-ответов.
