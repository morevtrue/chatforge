# План реализации: ChatForge Phase 1 — Инфраструктура и фундамент

## Обзор

Последовательная реализация инфраструктурного фундамента: Docker Compose окружение → Phoenix-бэкенд → миграции БД → React-фронтенд → Makefile. Каждый шаг строится на предыдущем и заканчивается интеграцией всех частей.

## Задачи

- [x] 1. Создать Docker Compose инфраструктуру и `.env.example`
  - Создать `docker-compose.yml` с сервисами `postgres`, `redis`, `minio`, `traefik`
  - Настроить healthcheck для `postgres` через `pg_isready`
  - Настроить `depends_on: condition: service_healthy` для зависимых сервисов
  - Создать `.env.example` с переменными `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY_BASE`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`
  - _Требования: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Инициализировать Phoenix-проект и настроить зависимости
  - [x] 2.1 Создать Phoenix-проект командой `mix phx.new chatforge --no-live --no-assets`
    - Проект создаётся в директории `backend/`
    - _Требования: 2.1_

  - [x] 2.2 Добавить зависимости в `mix.exs`
    - Добавить: `ecto_sql`, `postgrex`, `redix`, `guardian`, `bcrypt_elixir`, `oban`, `req`, `bodyguard`, `ex_aws`, `jason`
    - Запустить `mix deps.get`
    - _Требования: 2.2_

  - [x] 2.3 Настроить `config/runtime.exs` для чтения переменных окружения
    - `DATABASE_URL` через `System.fetch_env!/1` (обязательная)
    - `SECRET_KEY_BASE` через `System.fetch_env!/1` (обязательная)
    - `REDIS_URL` с дефолтом `redis://localhost:6379`
    - `PORT` с дефолтом `4000`
    - `CORS_ORIGINS` с дефолтом `http://localhost:5173`
    - _Требования: 2.3, 2.4, 2.5, 2.6_

  - [x] 2.4 Настроить Ecto Repo для PostgreSQL
    - Настроить `ChatForge.Repo` в `config/dev.exs` и `config/runtime.exs`
    - _Требования: 2.7_

- [x] 3. Создать структуру bounded contexts
  - [x] 3.1 Создать пустые модули для всех 7 контекстов
    - `ChatForge.Accounts` в `lib/chatforge/accounts/accounts.ex`
    - `ChatForge.Instances` в `lib/chatforge/instances/instances.ex`
    - `ChatForge.Chat` в `lib/chatforge/chat/chat.ex`
    - `ChatForge.Billing` в `lib/chatforge/billing/billing.ex`
    - `ChatForge.AI` в `lib/chatforge/ai/ai.ex`
    - `ChatForge.Analytics` в `lib/chatforge/analytics/analytics.ex`
    - `ChatForge.Admin` в `lib/chatforge/admin/admin.ex`
    - Каждый модуль содержит только `@moduledoc` с описанием зоны ответственности
    - _Требования: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Настроить роутер и health-check эндпоинт
  - [x] 4.1 Настроить `router.ex` с pipeline-ами и маршрутами
    - Pipeline `:api` с `plug :accepts, ["json"]` и `CORSPlug`
    - Pipeline `:authenticated` как заглушка
    - Маршрут `GET /health` → `HealthController.index`
    - _Требования: 4.1, 4.2_

  - [x] 4.2 Реализовать `HealthController`
    - Создать `lib/chatforge_web/controllers/health_controller.ex`
    - Возвращать `{"status": "ok", "timestamp": "<ISO8601>"}`
    - _Требования: 4.3_

  - [x] 4.3 Настроить CORS через `cors_plug`
    - Добавить `cors_plug` в зависимости
    - Настроить разрешённые origins из `CORS_ORIGINS`
    - _Требования: 4.4_

  - [ ]* 4.4 Написать тест для health-check эндпоинта
    - Создать `test/chatforge_web/controllers/health_controller_test.exs`
    - Проверить HTTP 200, поле `status: "ok"`, наличие `timestamp`
    - _Требования: 4.3_

  - [ ]* 4.5 Написать property-тест для health-check timestamp
    - **Свойство 1: Health-check возвращает валидный ISO8601 timestamp**
    - **Validates: Требования 4.3**
    - Добавить `stream_data` в зависимости `mix.exs`
    - Проверить что `timestamp` парсируется через `DateTime.from_iso8601/1`

- [x] 5. Checkpoint — убедиться что Phoenix запускается
  - Убедиться что `mix compile` проходит без ошибок, `GET /health` отвечает. Задать вопросы пользователю при необходимости.

- [x] 6. Создать миграции БД — контекст Accounts
  - [x] 6.1 Создать миграцию `20240001_create_users.exs`
    - Таблица `users`: `id uuid PK`, `email varchar not null`, `password_hash varchar not null`, `name varchar not null`, `phone varchar`, `telegram varchar`, `role varchar not null default 'creator'`, `timestamps()`
    - Уникальный индекс на `users.email`
    - _Требования: 5.1, 5.2, 5.3_

  - [ ]* 6.2 Написать property-тест для уникальности email в users
    - **Свойство 2: Уникальность email пользователей платформы**
    - **Validates: Требования 5.2**
    - Проверить что вставка двух записей с одинаковым email вызывает ошибку уникального ограничения

- [x] 7. Создать миграции БД — контекст Instances
  - [x] 7.1 Создать миграцию `20240002_create_chat_instances.exs`
    - Таблица `chat_instances`: `id uuid PK`, `creator_id uuid FK→users.id not null`, `name varchar not null`, `subdomain varchar not null`, `currency varchar not null`, `status varchar not null default 'draft'`, `timestamps()`
    - Уникальный индекс на `chat_instances.subdomain`
    - _Требования: 6.1, 6.2_

  - [ ]* 7.2 Написать property-тест для уникальности subdomain
    - **Свойство 3: Уникальность поддомена чат-инстанса**
    - **Validates: Требования 6.2**
    - Проверить что вставка двух записей с одинаковым subdomain вызывает ошибку уникального ограничения

  - [x] 7.3 Создать миграцию `20240003_create_instance_settings.exs`
    - Таблица `instance_settings`: `id uuid PK`, `chat_instance_id uuid FK→chat_instances.id not null`, `primary_color varchar`, `secondary_color varchar`, `background_color varchar`, `avatar_url varchar`, `greeting_text text`, `example_questions jsonb`, `system_prompt text`, `timestamps()`
    - _Требования: 6.3_

- [x] 8. Создать миграции БД — контекст Chat
  - [x] 8.1 Создать миграцию `20240004_create_end_users.exs`
    - Таблица `end_users`: `id uuid PK`, `chat_instance_id uuid FK→chat_instances.id not null`, `email varchar not null`, `password_hash varchar not null`, `name varchar not null`, `messages_used integer not null default 0`, `timestamps()`
    - Уникальный составной индекс на `(email, chat_instance_id)`
    - _Требования: 7.1, 7.2_

  - [ ]* 8.2 Написать property-тест для изоляции email end_users по тенанту
    - **Свойство 4: Изоляция email конечных пользователей по тенанту**
    - **Validates: Требования 7.2**
    - Проверить что одинаковый email разрешён в разных инстансах, но запрещён в одном

  - [x] 8.3 Создать миграцию `20240005_create_conversations.exs`
    - Таблица `conversations`: `id uuid PK`, `chat_instance_id uuid FK→chat_instances.id not null`, `end_user_id uuid FK→end_users.id not null`, `title varchar`, `timestamps()`
    - _Требования: 7.3_

  - [x] 8.4 Создать миграцию `20240006_create_messages.exs`
    - Таблица `messages`: `id uuid PK`, `conversation_id uuid FK→conversations.id not null`, `chat_instance_id uuid FK→chat_instances.id not null`, `role varchar not null`, `content text not null`, `tokens_used integer`, `inserted_at timestamp not null`
    - Индексы на `messages.conversation_id` и `messages.chat_instance_id`
    - _Требования: 7.4, 7.5_

- [x] 9. Создать миграции БД — контексты Billing, AI, Analytics
  - [x] 9.1 Создать миграцию `20240007_create_subscription_plans.exs`
    - Таблица `subscription_plans`: `id uuid PK`, `chat_instance_id uuid FK→chat_instances.id not null`, `name varchar not null`, `price decimal not null`, `period varchar not null`, `message_limit integer`, `is_active boolean not null default true`, `timestamps()`
    - _Требования: 8.1_

  - [x] 9.2 Создать миграцию `20240008_create_subscriptions.exs`
    - Таблица `subscriptions`: `id uuid PK`, `chat_instance_id uuid FK→chat_instances.id not null`, `end_user_id uuid FK→end_users.id not null`, `plan_id uuid FK→subscription_plans.id not null`, `status varchar not null`, `starts_at utc_datetime not null`, `expires_at utc_datetime`, `timestamps()`
    - _Требования: 8.2_

  - [x] 9.3 Создать миграцию `20240009_create_ai_usage_logs.exs`
    - Таблица `ai_usage_logs`: `id uuid PK`, `chat_instance_id uuid FK→chat_instances.id not null`, `conversation_id uuid FK→conversations.id not null`, `provider varchar not null`, `model varchar not null`, `input_tokens integer not null`, `output_tokens integer not null`, `cost decimal not null`, `inserted_at timestamp not null`
    - _Требования: 9.1_

  - [x] 9.4 Создать миграцию `20240010_create_events.exs`
    - Таблица `events`: `id uuid PK`, `chat_instance_id uuid FK→chat_instances.id nullable`, `event_type varchar not null`, `payload jsonb not null`, `inserted_at timestamp not null`
    - Индексы на `events.event_type` и `events.chat_instance_id`
    - _Требования: 9.2, 9.3_

- [x] 10. Checkpoint — убедиться что все миграции применяются
  - Убедиться что `mix ecto.create && mix ecto.migrate` проходит без ошибок, все 10 таблиц созданы. Задать вопросы пользователю при необходимости.

- [x] 11. Инициализировать React/TypeScript фронтенд
  - [x] 11.1 Создать Vite-проект с шаблоном `react-ts`
    - Команда: `npm create vite@latest frontend -- --template react-ts`
    - _Требования: 10.1_

  - [x] 11.2 Установить зависимости
    - Основные: `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `react-hook-form`, `zod`, `@hookform/resolvers`
    - UI: `tailwindcss`, `lucide-react`, `sonner`
    - _Требования: 10.2, 10.3_

  - [x] 11.3 Настроить Tailwind, Vite и TypeScript
    - Создать `tailwind.config.ts` с путями к компонентам
    - Настроить `vite.config.ts` с алиасом `@` для `src/`
    - _Требования: 10.4, 10.5_

  - [x] 11.4 Инициализировать shadcn/ui
    - Команда: `npx shadcn-ui@latest init`
    - _Требования: 10.6_

- [x] 12. Создать структуру папок и роутинг фронтенда
  - [x] 12.1 Создать структуру директорий
    - `src/app/`, `src/pages/platform/`, `src/pages/chat/`, `src/features/`, `src/shared/ui/`, `src/shared/lib/`, `src/shared/hooks/`, `src/shared/types/`
    - _Требования: 11.1_

  - [x] 12.2 Настроить `src/app/App.tsx` с роутингом
    - Маршруты платформы: `/`, `/login`, `/register`, `/dashboard`, `/builder`
    - Маршрут чат-инстанса: `/chat/*`
    - Все страницы кроме `/` — заглушки `<div>Coming soon</div>`
    - _Требования: 11.2, 11.3, 11.4_

  - [x] 12.3 Настроить `src/app/providers.tsx` с `QueryClientProvider` и `BrowserRouter`
    - Обернуть приложение в `BrowserRouter` и `QueryClientProvider`
    - _Требования: 11.6_

  - [x] 12.4 Создать Axios-инстанс в `src/shared/lib/api.ts`
    - `baseURL: import.meta.env.VITE_API_URL`
    - _Требования: 11.5_

  - [ ]* 12.5 Написать тест для Axios-инстанса
    - Создать `src/shared/lib/api.test.ts`
    - Проверить что `api.defaults.baseURL` равен `import.meta.env.VITE_API_URL`
    - _Требования: 11.5_

- [x] 13. Создать Makefile
  - Реализовать команды: `up`, `down`, `db.setup`, `db.migrate`, `db.reset`, `backend`, `frontend`
  - _Требования: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 14. Финальный checkpoint — интеграция всех компонентов
  - Убедиться что `make up` поднимает все сервисы, `make db.setup` применяет миграции, `GET /health` отвечает 200, фронтенд запускается. Задать вопросы пользователю при необходимости.

## Примечания

- Задачи с `*` — опциональные тесты, можно пропустить для быстрого MVP
- Порядок миграций строго соблюдается из-за FK-зависимостей: Accounts → Instances → Chat → Billing → AI → Analytics
- Property-тесты используют библиотеку `stream_data` (Elixir), frontend-тесты — Vitest
- Каждая задача ссылается на конкретные требования для трассируемости
