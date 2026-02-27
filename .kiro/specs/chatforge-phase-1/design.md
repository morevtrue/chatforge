# Дизайн — ChatForge Phase 1: Инфраструктура и фундамент

## Обзор

Phase 1 закладывает технический фундамент платформы ChatForge. Цель — получить полностью работающее dev-окружение: все инфраструктурные сервисы запущены через Docker Compose, Elixir/Phoenix-бэкенд стартует и отвечает на health-check, React/TypeScript-фронтенд запускается и отображает заглушку, база данных содержит все таблицы для 7 bounded contexts.

Фаза намеренно ограничена: никакой бизнес-логики, аутентификации, AI-интеграции. Только скелет и инфраструктура.

### Ключевые результаты фазы

- `make up` поднимает PostgreSQL 16, Redis 7, MinIO, Traefik 3
- `make db.setup` создаёт БД и применяет все 8 групп миграций
- `GET /health` возвращает `{"status": "ok", "timestamp": "..."}`
- `npm run dev` запускает фронтенд с базовым роутингом
- Структура всех 7 bounded contexts создана в `lib/chatforge/`

---

## Архитектура

### Общая схема Phase 1

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Compose (dev)                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │PostgreSQL│  │  Redis   │  │  MinIO   │  │Traefik │  │
│  │  :5432   │  │  :6379   │  │9000/9001 │  │ :80    │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└─────────────────────────────────────────────────────────┘
         │
         │ DATABASE_URL / REDIS_URL / env vars
         │
┌────────┴────────────────────────────────────────────────┐
│              Phoenix Application (локально)              │
│                                                          │
│  router.ex                                               │
│    pipeline :api  → GET /health → HealthController       │
│    pipeline :authenticated (заглушка)                    │
│                                                          │
│  lib/chatforge/                                          │
│    accounts/   instances/   chat/   billing/             │
│    ai/         analytics/   admin/                       │
│                                                          │
│  Ecto Repo → PostgreSQL                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              React/Vite App (локально)                   │
│                                                          │
│  src/app/          → BrowserRouter + QueryClientProvider │
│  src/pages/        → platform/ + chat/                   │
│  src/features/     → auth/ builder/ chat/ billing/       │
│  src/shared/       → ui/ lib/ hooks/ types/              │
│                                                          │
│  Axios instance → VITE_API_URL (Phoenix)                 │
└─────────────────────────────────────────────────────────┘
```

### Принципы, соблюдаемые с Phase 1

1. **Изоляция по tenant_id** — все таблицы данных тенанта содержат `chat_instance_id` (= tenant_id). Это закладывается на уровне схемы БД уже в Phase 1, даже без бизнес-логики.
2. **Bounded contexts** — каждый контекст — отдельная директория с пустым публичным модулем. Структура не позволяет случайно смешать зоны ответственности.
3. **Config через env** — никакого хардкода. `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY_BASE` читаются из окружения в `runtime.exs`.
4. **API-first** — фронтенд — просто клиент. Axios-инстанс настроен на `VITE_API_URL`.

---

## Компоненты и интерфейсы

### Docker Compose сервисы

| Сервис     | Образ              | Порты       | Назначение                        |
|------------|--------------------|-------------|-----------------------------------|
| `postgres`  | postgres:16-alpine | 5432        | Основное хранилище данных         |
| `redis`     | redis:7-alpine     | 6379        | Кеш, сессии, rate limiting        |
| `minio`     | minio/minio        | 9000, 9001  | S3-совместимое файловое хранилище |
| `traefik`   | traefik:v3         | 80, 443, 8080 | Reverse proxy, dashboard        |

Зависимости: Phoenix-приложение зависит от `postgres` (через healthcheck `pg_isready`).

### Phoenix — ключевые модули Phase 1

```
ChatForgeWeb.Router
  pipeline :api
    plug :accepts, ["json"]
    plug CORSPlug
  
  scope "/", ChatForgeWeb do
    pipe_through :api
    get "/health", HealthController, :index
  end

ChatForgeWeb.HealthController
  def index(conn, _params) do
    json(conn, %{status: "ok", timestamp: DateTime.utc_now() |> DateTime.to_iso8601()})
  end
```

Каждый bounded context — пустой модуль с документацией зоны ответственности:

```elixir
defmodule ChatForge.Accounts do
  @moduledoc """
  Контекст Accounts: регистрация, аутентификация, профили Creator-ов.
  """
end
```

### Frontend — ключевые модули Phase 1

```
src/app/
  App.tsx          → BrowserRouter + QueryClientProvider + Routes
  providers.tsx    → QueryClient config

src/shared/lib/
  api.ts           → Axios instance (baseURL: import.meta.env.VITE_API_URL)

src/pages/platform/
  HomePage.tsx     → заглушка главной страницы
```

Роутинг Phase 1:

| Маршрут      | Компонент         | Тип        |
|--------------|-------------------|------------|
| `/`          | `HomePage`        | Платформа  |
| `/login`     | `LoginPage`       | Платформа  |
| `/register`  | `RegisterPage`    | Платформа  |
| `/dashboard` | `DashboardPage`   | Платформа  |
| `/builder`   | `BuilderPage`     | Платформа  |
| `/chat/*`    | `ChatRoutes`      | Инстанс    |

Все страницы кроме `/` — заглушки (`<div>Coming soon</div>`).

### Makefile команды

| Команда         | Действие                                              |
|-----------------|-------------------------------------------------------|
| `make up`       | `docker compose up -d`                                |
| `make down`     | `docker compose down`                                 |
| `make db.setup` | `mix ecto.create && mix ecto.migrate`                 |
| `make db.migrate`| `mix ecto.migrate`                                   |
| `make db.reset` | `mix ecto.drop && mix ecto.create && mix ecto.migrate`|
| `make backend`  | `mix phx.server`                                      |
| `make frontend` | `cd frontend && npm run dev`                          |

---

## Модели данных

Все миграции применяются в строгом порядке из-за FK-зависимостей:
`Accounts → Instances → Chat → Billing → AI → Analytics`

### Accounts — таблица `users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  name          VARCHAR NOT NULL,
  phone         VARCHAR,
  telegram      VARCHAR,
  role          VARCHAR NOT NULL DEFAULT 'creator',
  inserted_at   TIMESTAMP NOT NULL,
  updated_at    TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX users_email_index ON users(email);
```

### Instances — таблицы `chat_instances`, `instance_settings`

```sql
CREATE TABLE chat_instances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES users(id),
  name        VARCHAR NOT NULL,
  subdomain   VARCHAR NOT NULL,
  currency    VARCHAR NOT NULL,
  status      VARCHAR NOT NULL DEFAULT 'draft',
  inserted_at TIMESTAMP NOT NULL,
  updated_at  TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX chat_instances_subdomain_index ON chat_instances(subdomain);

CREATE TABLE instance_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id  UUID NOT NULL REFERENCES chat_instances(id),
  primary_color     VARCHAR,
  secondary_color   VARCHAR,
  background_color  VARCHAR,
  avatar_url        VARCHAR,
  greeting_text     TEXT,
  example_questions JSONB,
  system_prompt     TEXT,
  inserted_at       TIMESTAMP NOT NULL,
  updated_at        TIMESTAMP NOT NULL
);
```

### Chat — таблицы `end_users`, `conversations`, `messages`

```sql
CREATE TABLE end_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id),
  email            VARCHAR NOT NULL,
  password_hash    VARCHAR NOT NULL,
  name             VARCHAR NOT NULL,
  messages_used    INTEGER NOT NULL DEFAULT 0,
  inserted_at      TIMESTAMP NOT NULL,
  updated_at       TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX end_users_email_instance_index ON end_users(email, chat_instance_id);

CREATE TABLE conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id),
  end_user_id      UUID NOT NULL REFERENCES end_users(id),
  title            VARCHAR,
  inserted_at      TIMESTAMP NOT NULL,
  updated_at       TIMESTAMP NOT NULL
);

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id),
  role             VARCHAR NOT NULL,
  content          TEXT NOT NULL,
  tokens_used      INTEGER,
  inserted_at      TIMESTAMP NOT NULL
);
CREATE INDEX messages_conversation_id_index ON messages(conversation_id);
CREATE INDEX messages_chat_instance_id_index ON messages(chat_instance_id);
```

### Billing — таблицы `subscription_plans`, `subscriptions`

```sql
CREATE TABLE subscription_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id),
  name             VARCHAR NOT NULL,
  price            DECIMAL NOT NULL,
  period           VARCHAR NOT NULL,
  message_limit    INTEGER,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  inserted_at      TIMESTAMP NOT NULL,
  updated_at       TIMESTAMP NOT NULL
);

CREATE TABLE subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id),
  end_user_id      UUID NOT NULL REFERENCES end_users(id),
  plan_id          UUID NOT NULL REFERENCES subscription_plans(id),
  status           VARCHAR NOT NULL,
  starts_at        TIMESTAMP NOT NULL,
  expires_at       TIMESTAMP,
  inserted_at      TIMESTAMP NOT NULL,
  updated_at       TIMESTAMP NOT NULL
);
```

### AI — таблица `ai_usage_logs`

```sql
CREATE TABLE ai_usage_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id),
  conversation_id  UUID NOT NULL REFERENCES conversations(id),
  provider         VARCHAR NOT NULL,
  model            VARCHAR NOT NULL,
  input_tokens     INTEGER NOT NULL,
  output_tokens    INTEGER NOT NULL,
  cost             DECIMAL NOT NULL,
  inserted_at      TIMESTAMP NOT NULL
);
```

### Analytics — таблица `events`

```sql
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID REFERENCES chat_instances(id),
  event_type       VARCHAR NOT NULL,
  payload          JSONB NOT NULL,
  inserted_at      TIMESTAMP NOT NULL
);
CREATE INDEX events_event_type_index ON events(event_type);
CREATE INDEX events_chat_instance_id_index ON events(chat_instance_id);
```

### Порядок применения миграций

```
20240001_create_users.exs
20240002_create_chat_instances.exs
20240003_create_instance_settings.exs
20240004_create_end_users.exs
20240005_create_conversations.exs
20240006_create_messages.exs
20240007_create_subscription_plans.exs
20240008_create_subscriptions.exs
20240009_create_ai_usage_logs.exs
20240010_create_events.exs
```


---

## Свойства корректности

*Свойство — это характеристика или поведение, которое должно выполняться при всех допустимых выполнениях системы. По сути, это формальное утверждение о том, что система должна делать. Свойства служат мостом между читаемыми человеком спецификациями и машинно-верифицируемыми гарантиями корректности.*

Phase 1 — преимущественно инфраструктурная фаза. Большинство критериев приёмки проверяются как конкретные примеры (наличие файлов, конфигурации, таблиц). Тем не менее, несколько ключевых инвариантов поддаются формализации как свойства.

### Свойство 1: Health-check возвращает валидный timestamp

*Для любого* момента времени, когда выполняется запрос `GET /health`, ответ должен содержать поле `timestamp` в формате ISO8601, и это значение должно быть парсируемой датой, не отличающейся от текущего времени более чем на разумный интервал (например, 5 секунд).

**Validates: Requirements 4.3**

### Свойство 2: Уникальность email пользователей платформы

*Для любых* двух попыток вставить записи в таблицу `users` с одинаковым значением поля `email`, вторая вставка должна завершиться ошибкой нарушения уникального ограничения.

**Validates: Requirements 5.2**

### Свойство 3: Уникальность поддомена чат-инстанса

*Для любых* двух попыток вставить записи в таблицу `chat_instances` с одинаковым значением поля `subdomain`, вторая вставка должна завершиться ошибкой нарушения уникального ограничения.

**Validates: Requirements 6.2**

### Свойство 4: Изоляция email конечных пользователей по тенанту

*Для любых* двух записей в таблице `end_users` с одинаковым `email` но разными `chat_instance_id`, обе записи должны успешно существовать. Однако попытка вставить запись с одинаковыми `email` и `chat_instance_id` должна завершиться ошибкой уникального ограничения.

Это свойство формализует ключевой инвариант multi-tenancy: один и тот же email может быть зарегистрирован в разных чат-инстансах независимо, но не дважды в одном.

**Validates: Requirements 7.2**

---

## Обработка ошибок

### Отсутствие обязательных переменных окружения

В `config/runtime.exs` все обязательные переменные читаются через `System.fetch_env!/1`, который вызывает исключение при отсутствии переменной. Это приводит к немедленному завершению запуска с описательным сообщением.

```elixir
# config/runtime.exs
database_url = System.fetch_env!("DATABASE_URL")
# При отсутствии: ** (System.EnvError) could not fetch environment variable "DATABASE_URL"
```

Обязательные переменные: `DATABASE_URL`, `SECRET_KEY_BASE`.
Опциональные (с дефолтами): `REDIS_URL` (дефолт: `redis://localhost:6379`), `PORT` (дефолт: `4000`).

### Недоступность PostgreSQL при старте

Docker Compose настроен с `depends_on: condition: service_healthy` для сервиса `postgres`. Healthcheck использует `pg_isready`. Phoenix-приложение при локальном запуске без Docker должно получить понятную ошибку от Ecto при попытке подключения.

### CORS ошибки

`cors_plug` настраивается с явным списком разрешённых origins через переменную окружения `CORS_ORIGINS`. В dev-режиме разрешается `http://localhost:5173` (Vite dev server).

### Ошибки миграций

Ecto отслеживает применённые миграции в таблице `schema_migrations`. Повторный запуск `mix ecto.migrate` безопасен — уже применённые миграции пропускаются. При ошибке в миграции транзакция откатывается (PostgreSQL поддерживает DDL в транзакциях).

---

## Стратегия тестирования

Phase 1 — инфраструктурная фаза. Тестирование фокусируется на проверке корректности конфигурации и схемы БД, а не на бизнес-логике.

### Подход к тестированию

**Два уровня тестов:**
- **Unit/Integration тесты** — проверяют конкретные примеры: структуру таблиц, конфигурацию, ответ health-check эндпоинта.
- **Property-based тесты** — проверяют универсальные свойства: уникальность ограничений в БД, корректность timestamp в ответах.

### Unit/Integration тесты (ExUnit)

**Health-check:**
```elixir
# test/chatforge_web/controllers/health_controller_test.exs
test "GET /health returns 200 with status ok" do
  conn = get(conn, "/health")
  assert json_response(conn, 200)["status"] == "ok"
  assert json_response(conn, 200)["timestamp"] != nil
end
```

**Структура таблиц (через Ecto migrations):**
- Проверка что все таблицы существуют после `mix ecto.migrate`
- Проверка наличия FK-ограничений
- Проверка дефолтных значений

**Конфигурация:**
- Проверка что `runtime.exs` читает переменные из окружения

### Property-based тесты (StreamData)

Библиотека: [`stream_data`](https://hex.pm/packages/stream_data) — стандартная PBT-библиотека для Elixir.

Минимум 100 итераций на каждый property-тест.

**Свойство 1: Health-check timestamp**
```elixir
# Feature: chatforge-phase-1, Property 1: health-check returns valid ISO8601 timestamp
property "GET /health timestamp is valid ISO8601" do
  check all _ <- StreamData.constant(:ok), max_runs: 100 do
    conn = get(build_conn(), "/health")
    body = json_response(conn, 200)
    {:ok, _dt, _offset} = DateTime.from_iso8601(body["timestamp"])
  end
end
```

**Свойство 2: Уникальность email в users**
```elixir
# Feature: chatforge-phase-1, Property 2: users email uniqueness
property "inserting two users with same email raises unique constraint" do
  check all email <- StreamData.string(:alphanumeric, min_length: 5),
            max_runs: 100 do
    email = email <> "@example.com"
    {:ok, _} = insert_user(email: email)
    {:error, changeset} = insert_user(email: email)
    assert {:email, _} = hd(changeset.errors)
  end
end
```

**Свойство 3: Уникальность subdomain в chat_instances**
```elixir
# Feature: chatforge-phase-1, Property 3: chat_instances subdomain uniqueness
property "inserting two chat_instances with same subdomain raises unique constraint" do
  check all subdomain <- StreamData.string(:alphanumeric, min_length: 3),
            max_runs: 100 do
    {:ok, _} = insert_chat_instance(subdomain: subdomain)
    {:error, changeset} = insert_chat_instance(subdomain: subdomain)
    assert {:subdomain, _} = hd(changeset.errors)
  end
end
```

**Свойство 4: Изоляция email end_users по тенанту**
```elixir
# Feature: chatforge-phase-1, Property 4: end_users email isolation per tenant
property "same email allowed in different instances, rejected in same instance" do
  check all email <- StreamData.string(:alphanumeric, min_length: 5),
            max_runs: 100 do
    email = email <> "@example.com"
    {:ok, instance1} = insert_chat_instance()
    {:ok, instance2} = insert_chat_instance()
    # Один email в разных инстансах — OK
    {:ok, _} = insert_end_user(email: email, chat_instance_id: instance1.id)
    {:ok, _} = insert_end_user(email: email, chat_instance_id: instance2.id)
    # Тот же email в том же инстансе — ошибка
    {:error, changeset} = insert_end_user(email: email, chat_instance_id: instance1.id)
    assert {:email, _} = hd(changeset.errors)
  end
end
```

### Frontend тесты (Vitest)

В Phase 1 фронтенд содержит только заглушки. Минимальные тесты:
- Проверка что `App` рендерится без ошибок
- Проверка что роутинг настроен (маршруты существуют)
- Проверка что Axios-инстанс использует `VITE_API_URL`

```typescript
// src/shared/lib/api.test.ts
import { api } from './api'
test('api baseURL matches VITE_API_URL', () => {
  expect(api.defaults.baseURL).toBe(import.meta.env.VITE_API_URL)
})
```

### Запуск тестов

```bash
# Backend (одиночный запуск, без watch)
mix test

# Frontend (одиночный запуск)
cd frontend && npx vitest --run
```
