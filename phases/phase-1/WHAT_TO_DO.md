# Phase 1 — Инфраструктура и фундамент

**Название фазы:** Инфраструктура, БД, скелет приложения
**Статус:** ✅ Завершена

---

## Цель фазы

Поднять рабочее окружение и создать скелет обоих приложений.
После этой фазы — всё запускается, health-check отвечает, БД создана со всеми таблицами.

---

## Задачи

### 1.1 Docker Compose — инфраструктура
- [ ] Добавить сервис `postgres` (PostgreSQL 16, volume для данных, healthcheck)
- [ ] Добавить сервис `redis` (Redis 7, volume для данных)
- [ ] Добавить сервис `minio` (MinIO, volume, порты 9000/9001)
- [ ] Добавить сервис `traefik` (Traefik 3, dashboard, labels для поддоменов)
- [ ] Создать `.env.example` с переменными: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY_BASE`, `MINIO_*`

### 1.2 Elixir/Phoenix — создание проекта
- [ ] Инициализировать Phoenix-проект (`mix phx.new chatforge --no-live --no-assets`)
- [ ] Добавить зависимости в `mix.exs`: `ecto_sql`, `postgrex`, `redix`, `guardian`, `bcrypt_elixir`, `oban`, `req`, `bodyguard`, `ex_aws`, `jason`
- [ ] Настроить `config/dev.exs`, `config/prod.exs`, `config/runtime.exs` через env-переменные
- [ ] Настроить Ecto Repo для PostgreSQL

### 1.3 Elixir/Phoenix — структура контекстов
- [ ] Создать пустой модуль `ChatForge.Accounts` (`lib/chatforge/accounts/`)
- [ ] Создать пустой модуль `ChatForge.Instances` (`lib/chatforge/instances/`)
- [ ] Создать пустой модуль `ChatForge.Chat` (`lib/chatforge/chat/`)
- [ ] Создать пустой модуль `ChatForge.Billing` (`lib/chatforge/billing/`)
- [ ] Создать пустой модуль `ChatForge.AI` (`lib/chatforge/ai/`)
- [ ] Создать пустой модуль `ChatForge.Analytics` (`lib/chatforge/analytics/`)
- [ ] Создать пустой модуль `ChatForge.Admin` (`lib/chatforge/admin/`)

### 1.4 Elixir/Phoenix — роутер и health-check
- [ ] Настроить `router.ex`: базовые pipeline-ы (`:api`, `:authenticated`)
- [ ] Реализовать `GET /health` → `{"status": "ok", "timestamp": "..."}`
- [ ] Настроить CORS через `cors_plug`

### 1.5 Миграции БД — Accounts
- [ ] Миграция: таблица `users` (`id uuid`, `email`, `password_hash`, `name`, `phone`, `telegram`, `role`, `inserted_at`, `updated_at`)
- [ ] Уникальный индекс на `users.email`

### 1.6 Миграции БД — Instances
- [ ] Миграция: таблица `chat_instances` (`id uuid`, `creator_id → users`, `name`, `subdomain`, `currency`, `status`, `inserted_at`, `updated_at`)
- [ ] Уникальный индекс на `chat_instances.subdomain`
- [ ] Миграция: таблица `instance_settings` (`id uuid`, `chat_instance_id → chat_instances`, `primary_color`, `secondary_color`, `background_color`, `avatar_url`, `greeting_text`, `example_questions jsonb`, `system_prompt`, `inserted_at`, `updated_at`)

### 1.7 Миграции БД — Chat
- [ ] Миграция: таблица `end_users` (`id uuid`, `chat_instance_id`, `email`, `password_hash`, `name`, `messages_used integer default 0`, `inserted_at`, `updated_at`)
- [ ] Уникальный индекс на `(end_users.email, end_users.chat_instance_id)`
- [ ] Миграция: таблица `conversations` (`id uuid`, `chat_instance_id`, `end_user_id`, `title`, `inserted_at`, `updated_at`)
- [ ] Миграция: таблица `messages` (`id uuid`, `conversation_id`, `chat_instance_id`, `role varchar`, `content text`, `tokens_used integer`, `inserted_at`)
- [ ] Индексы на `messages.conversation_id`, `messages.chat_instance_id`

### 1.8 Миграции БД — Billing
- [ ] Миграция: таблица `subscription_plans` (`id uuid`, `chat_instance_id`, `name`, `price decimal`, `period varchar`, `message_limit integer nullable`, `is_active boolean default true`, `inserted_at`, `updated_at`)
- [ ] Миграция: таблица `subscriptions` (`id uuid`, `chat_instance_id`, `end_user_id`, `plan_id → subscription_plans`, `status varchar`, `starts_at`, `expires_at`, `inserted_at`, `updated_at`)

### 1.9 Миграции БД — AI и Analytics
- [ ] Миграция: таблица `ai_usage_logs` (`id uuid`, `chat_instance_id`, `conversation_id`, `provider`, `model`, `input_tokens integer`, `output_tokens integer`, `cost decimal`, `inserted_at`)
- [ ] Миграция: таблица `events` (`id uuid`, `chat_instance_id nullable`, `event_type varchar`, `payload jsonb`, `inserted_at`)
- [ ] Индекс на `events.event_type`, `events.chat_instance_id`

### 1.10 React/TypeScript — создание проекта
- [ ] Инициализировать Vite-проект (`npm create vite@latest frontend -- --template react-ts`)
- [ ] Установить зависимости: `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `react-hook-form`, `zod`, `@hookform/resolvers`
- [ ] Установить UI: `tailwindcss`, `@shadcn/ui`, `lucide-react`, `sonner`
- [ ] Настроить `tailwind.config.ts`, `tsconfig.json`, `vite.config.ts`
- [ ] Инициализировать shadcn/ui (`npx shadcn-ui@latest init`)

### 1.11 React/TypeScript — структура папок
- [ ] Создать структуру: `src/app/`, `src/pages/platform/`, `src/pages/chat/`, `src/features/`, `src/shared/ui/`, `src/shared/lib/`, `src/shared/hooks/`, `src/shared/types/`
- [ ] Настроить роутинг: платформа (`/`, `/login`, `/register`, `/dashboard`, `/builder`) и чат (`/chat/*`)
- [ ] Создать заглушку главной страницы платформы
- [ ] Настроить API-клиент (`axios` instance с базовым URL из env)
- [ ] Настроить `QueryClientProvider` и `BrowserRouter` в `src/app/`

### 1.12 Makefile и инструменты
- [ ] `make up` — поднять Docker Compose
- [ ] `make down` — остановить
- [ ] `make db.setup` — создать БД и применить миграции
- [ ] `make db.migrate` — применить новые миграции
- [ ] `make db.reset` — сбросить и пересоздать БД
- [ ] `make backend` — запустить Phoenix сервер
- [ ] `make frontend` — запустить Vite dev server

---

## Ограничения

- НЕ входит: аутентификация, бизнес-логика, AI-интеграция.
- НЕ входит: деплой, CI/CD, мониторинг.
- Только скелет и инфраструктура.

---

## Ссылки

- Архитектура: `sources-of-truth/ARCHITECTURE.md`
- Технический стек: `sources-of-truth/TECH_SPEC.md`
