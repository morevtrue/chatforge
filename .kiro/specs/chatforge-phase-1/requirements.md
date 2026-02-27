# Требования — ChatForge Phase 1: Инфраструктура и фундамент

## Введение

Phase 1 закладывает технический фундамент платформы ChatForge: поднимает инфраструктуру через Docker Compose, создаёт скелет Elixir/Phoenix-бэкенда и React/TypeScript-фронтенда, применяет все миграции БД для 7 bounded contexts. После завершения фазы оба приложения запускаются, health-check отвечает, база данных содержит все таблицы согласно архитектурной схеме.

Фаза не включает: аутентификацию, бизнес-логику, AI-интеграцию, деплой, CI/CD.

---

## Глоссарий

- **System** — платформа ChatForge в целом.
- **Docker_Compose** — инструмент оркестрации контейнеров для dev-окружения.
- **Phoenix_App** — Elixir/Phoenix-приложение (бэкенд ChatForge).
- **Frontend_App** — React/TypeScript/Vite-приложение (фронтенд ChatForge).
- **Repo** — Ecto Repo, слой доступа к PostgreSQL.
- **Migration** — Ecto-миграция, изменяющая схему БД.
- **Context** — bounded context в Elixir (модуль с публичным API).
- **Router** — Phoenix Router, маршрутизатор HTTP-запросов.
- **Health_Check** — эндпоинт проверки работоспособности сервиса.
- **Makefile** — файл с командами для управления проектом.
- **tenant_id** — идентификатор тенанта (= `chat_instance_id`), присутствующий во всех таблицах данных тенанта.
- **Creator** — пользователь платформы, создающий AI-чатботы.
- **End_User** — конечный пользователь чат-инстанса.

---

## Требования

### Требование 1: Docker Compose — инфраструктура dev-окружения

**User Story:** Как разработчик, я хочу одной командой поднять все зависимости проекта, чтобы начать разработку без ручной установки сервисов.

#### Критерии приёмки

1. THE Docker_Compose SHALL содержать сервис `postgres` на базе PostgreSQL 16 с volume для персистентности данных и healthcheck.
2. THE Docker_Compose SHALL содержать сервис `redis` на базе Redis 7 с volume для персистентности данных.
3. THE Docker_Compose SHALL содержать сервис `minio` с доступом через порты 9000 (API) и 9001 (консоль) и volume для хранения файлов.
4. THE Docker_Compose SHALL содержать сервис `traefik` на базе Traefik 3 с включённым dashboard и поддержкой динамических поддоменов.
5. THE System SHALL содержать файл `.env.example` с переменными: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY_BASE`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`.
6. WHEN сервис `postgres` запускается, THE Docker_Compose SHALL дождаться успешного healthcheck перед стартом зависимых сервисов.

---

### Требование 2: Elixir/Phoenix — инициализация проекта

**User Story:** Как разработчик, я хочу иметь готовый Phoenix-проект с настроенными зависимостями, чтобы сразу начать реализацию бизнес-логики.

#### Критерии приёмки

1. THE Phoenix_App SHALL быть инициализирован командой `mix phx.new chatforge --no-live --no-assets`.
2. THE Phoenix_App SHALL содержать в `mix.exs` зависимости: `ecto_sql`, `postgrex`, `redix`, `guardian`, `bcrypt_elixir`, `oban`, `req`, `bodyguard`, `ex_aws`, `jason`.
3. THE Phoenix_App SHALL читать конфигурацию подключения к PostgreSQL из переменной окружения `DATABASE_URL` в `config/runtime.exs`.
4. THE Phoenix_App SHALL читать конфигурацию подключения к Redis из переменной окружения `REDIS_URL` в `config/runtime.exs`.
5. THE Phoenix_App SHALL читать `SECRET_KEY_BASE` из переменной окружения в `config/runtime.exs`.
6. IF переменная окружения `DATABASE_URL` не задана при старте в production, THEN THE Phoenix_App SHALL завершить запуск с описательным сообщением об ошибке.
7. THE Repo SHALL быть настроен для работы с PostgreSQL через Ecto.

---

### Требование 3: Elixir/Phoenix — структура bounded contexts

**User Story:** Как разработчик, я хочу иметь готовую структуру модулей для всех bounded contexts, чтобы реализовывать бизнес-логику в правильных местах.

#### Критерии приёмки

1. THE Phoenix_App SHALL содержать модуль `ChatForge.Accounts` в директории `lib/chatforge/accounts/`.
2. THE Phoenix_App SHALL содержать модуль `ChatForge.Instances` в директории `lib/chatforge/instances/`.
3. THE Phoenix_App SHALL содержать модуль `ChatForge.Chat` в директории `lib/chatforge/chat/`.
4. THE Phoenix_App SHALL содержать модуль `ChatForge.Billing` в директории `lib/chatforge/billing/`.
5. THE Phoenix_App SHALL содержать модуль `ChatForge.AI` в директории `lib/chatforge/ai/`.
6. THE Phoenix_App SHALL содержать модуль `ChatForge.Analytics` в директории `lib/chatforge/analytics/`.
7. THE Phoenix_App SHALL содержать модуль `ChatForge.Admin` в директории `lib/chatforge/admin/`.
8. THE System SHALL обеспечить, что каждый Context-модуль содержит только публичный API и не обращается к Ecto-схемам других контекстов напрямую.

---

### Требование 4: Elixir/Phoenix — роутер и health-check

**User Story:** Как разработчик и оператор, я хочу иметь базовый роутер и health-check эндпоинт, чтобы проверять работоспособность сервиса.

#### Критерии приёмки

1. THE Router SHALL содержать pipeline `:api` с парсингом JSON и базовыми plug-ами.
2. THE Router SHALL содержать pipeline `:authenticated` для защищённых маршрутов (заглушка для Phase 1).
3. WHEN запрос `GET /health` получен, THE Health_Check SHALL вернуть HTTP 200 с телом `{"status": "ok", "timestamp": "<ISO8601>"}`.
4. THE Phoenix_App SHALL быть настроен с CORS через `cors_plug`, разрешающим запросы с фронтенд-домена.

---

### Требование 5: Миграции БД — контекст Accounts

**User Story:** Как разработчик, я хочу иметь таблицу `users` в БД, чтобы хранить данные Creator-ов платформы.

#### Критерии приёмки

1. THE Migration SHALL создать таблицу `users` со столбцами: `id` (UUID, PK), `email` (string, not null), `password_hash` (string, not null), `name` (string, not null), `phone` (string, nullable), `telegram` (string, nullable), `role` (string, not null, default `"creator"`), `inserted_at`, `updated_at`.
2. THE Migration SHALL создать уникальный индекс на столбце `users.email`.
3. WHEN миграция применяется повторно, THE Migration SHALL завершиться без ошибок (идемпотентность через Ecto).

---

### Требование 6: Миграции БД — контекст Instances

**User Story:** Как разработчик, я хочу иметь таблицы для Chat Instance и его настроек, чтобы хранить данные о чат-инстансах Creator-ов.

#### Критерии приёмки

1. THE Migration SHALL создать таблицу `chat_instances` со столбцами: `id` (UUID, PK), `creator_id` (UUID, FK → `users.id`, not null), `name` (string, not null), `subdomain` (string, not null), `currency` (string, not null), `status` (string, not null, default `"draft"`), `inserted_at`, `updated_at`.
2. THE Migration SHALL создать уникальный индекс на столбце `chat_instances.subdomain`.
3. THE Migration SHALL создать таблицу `instance_settings` со столбцами: `id` (UUID, PK), `chat_instance_id` (UUID, FK → `chat_instances.id`, not null), `primary_color` (string), `secondary_color` (string), `background_color` (string), `avatar_url` (string), `greeting_text` (text), `example_questions` (JSONB), `system_prompt` (text), `inserted_at`, `updated_at`.

---

### Требование 7: Миграции БД — контекст Chat

**User Story:** Как разработчик, я хочу иметь таблицы для конечных пользователей, диалогов и сообщений, чтобы хранить данные чат-инстансов.

#### Критерии приёмки

1. THE Migration SHALL создать таблицу `end_users` со столбцами: `id` (UUID, PK), `chat_instance_id` (UUID, FK → `chat_instances.id`, not null), `email` (string, not null), `password_hash` (string, not null), `name` (string, not null), `messages_used` (integer, not null, default 0), `inserted_at`, `updated_at`.
2. THE Migration SHALL создать уникальный составной индекс на `(end_users.email, end_users.chat_instance_id)`.
3. THE Migration SHALL создать таблицу `conversations` со столбцами: `id` (UUID, PK), `chat_instance_id` (UUID, FK → `chat_instances.id`, not null), `end_user_id` (UUID, FK → `end_users.id`, not null), `title` (string), `inserted_at`, `updated_at`.
4. THE Migration SHALL создать таблицу `messages` со столбцами: `id` (UUID, PK), `conversation_id` (UUID, FK → `conversations.id`, not null), `chat_instance_id` (UUID, FK → `chat_instances.id`, not null), `role` (string, not null), `content` (text, not null), `tokens_used` (integer), `inserted_at`.
5. THE Migration SHALL создать индексы на `messages.conversation_id` и `messages.chat_instance_id`.

---

### Требование 8: Миграции БД — контекст Billing

**User Story:** Как разработчик, я хочу иметь таблицы для тарифных планов и подписок, чтобы хранить данные о монетизации чат-инстансов.

#### Критерии приёмки

1. THE Migration SHALL создать таблицу `subscription_plans` со столбцами: `id` (UUID, PK), `chat_instance_id` (UUID, FK → `chat_instances.id`, not null), `name` (string, not null), `price` (decimal, not null), `period` (string, not null), `message_limit` (integer, nullable), `is_active` (boolean, not null, default true), `inserted_at`, `updated_at`.
2. THE Migration SHALL создать таблицу `subscriptions` со столбцами: `id` (UUID, PK), `chat_instance_id` (UUID, FK → `chat_instances.id`, not null), `end_user_id` (UUID, FK → `end_users.id`, not null), `plan_id` (UUID, FK → `subscription_plans.id`, not null), `status` (string, not null), `starts_at` (utc_datetime, not null), `expires_at` (utc_datetime, nullable), `inserted_at`, `updated_at`.

---

### Требование 9: Миграции БД — контексты AI и Analytics

**User Story:** Как разработчик, я хочу иметь таблицы для логов AI и аналитических событий, чтобы хранить данные об использовании AI и активности пользователей.

#### Критерии приёмки

1. THE Migration SHALL создать таблицу `ai_usage_logs` со столбцами: `id` (UUID, PK), `chat_instance_id` (UUID, FK → `chat_instances.id`, not null), `conversation_id` (UUID, FK → `conversations.id`, not null), `provider` (string, not null), `model` (string, not null), `input_tokens` (integer, not null), `output_tokens` (integer, not null), `cost` (decimal, not null), `inserted_at`.
2. THE Migration SHALL создать таблицу `events` со столбцами: `id` (UUID, PK), `chat_instance_id` (UUID, FK → `chat_instances.id`, nullable), `event_type` (string, not null), `payload` (JSONB, not null), `inserted_at`.
3. THE Migration SHALL создать индексы на `events.event_type` и `events.chat_instance_id`.

---

### Требование 10: React/TypeScript — инициализация проекта

**User Story:** Как разработчик, я хочу иметь готовый React/TypeScript-проект с настроенными зависимостями, чтобы сразу начать реализацию UI.

#### Критерии приёмки

1. THE Frontend_App SHALL быть инициализирован через Vite с шаблоном `react-ts`.
2. THE Frontend_App SHALL содержать зависимости: `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `react-hook-form`, `zod`, `@hookform/resolvers`.
3. THE Frontend_App SHALL содержать UI-зависимости: `tailwindcss`, `lucide-react`, `sonner`.
4. THE Frontend_App SHALL содержать настроенный `tailwind.config.ts` с путями к компонентам.
5. THE Frontend_App SHALL содержать настроенный `vite.config.ts` с алиасом `@` для директории `src/`.
6. THE Frontend_App SHALL быть инициализирован с shadcn/ui.

---

### Требование 11: React/TypeScript — структура проекта и роутинг

**User Story:** Как разработчик, я хочу иметь готовую структуру папок и базовый роутинг, чтобы добавлять страницы и фичи в правильные места.

#### Критерии приёмки

1. THE Frontend_App SHALL содержать директории: `src/app/`, `src/pages/platform/`, `src/pages/chat/`, `src/features/`, `src/shared/ui/`, `src/shared/lib/`, `src/shared/hooks/`, `src/shared/types/`.
2. THE Router SHALL содержать маршруты платформы: `/` (главная), `/login`, `/register`, `/dashboard`, `/builder`.
3. THE Router SHALL содержать маршруты чат-инстанса: `/chat/*`.
4. THE Frontend_App SHALL содержать заглушку главной страницы платформы по маршруту `/`.
5. THE Frontend_App SHALL содержать настроенный Axios-инстанс с базовым URL из переменной окружения `VITE_API_URL`.
6. THE Frontend_App SHALL содержать `QueryClientProvider` и `BrowserRouter` в точке входа `src/app/`.

---

### Требование 12: Makefile — команды управления проектом

**User Story:** Как разработчик, я хочу иметь единый Makefile с командами для управления проектом, чтобы не запоминать длинные команды.

#### Критерии приёмки

1. WHEN выполняется `make up`, THE Makefile SHALL запустить Docker Compose в фоновом режиме.
2. WHEN выполняется `make down`, THE Makefile SHALL остановить все сервисы Docker Compose.
3. WHEN выполняется `make db.setup`, THE Makefile SHALL создать БД и применить все миграции.
4. WHEN выполняется `make db.migrate`, THE Makefile SHALL применить новые миграции без пересоздания БД.
5. WHEN выполняется `make db.reset`, THE Makefile SHALL сбросить БД, пересоздать её и применить все миграции.
6. WHEN выполняется `make backend`, THE Makefile SHALL запустить Phoenix-сервер командой `mix phx.server`.
7. WHEN выполняется `make frontend`, THE Makefile SHALL запустить Vite dev server командой `npm run dev` в директории `frontend/`.
