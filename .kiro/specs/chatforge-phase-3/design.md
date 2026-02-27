# Дизайн — ChatForge Phase 3: Визард создания чата (Builder)

## Обзор

Phase 3 реализует ключевую бизнес-функцию платформы ChatForge — пошаговый визард создания AI-чата.
Creator проходит 4 шага: выбор цветовой схемы, задание названия и валюты, настройка приветствия
и аватара, установка лимита бесплатных сообщений. После финализации создаётся `ChatInstance`
со статусом `active`, доступный по уникальному поддомену.

Фаза включает:
- Bounded context `ChatForge.Instances` с Ecto-схемами и бизнес-логикой
- Загрузку файлов в S3/MinIO через `ex_aws`
- REST API для визарда (`BuilderController`) и управления инстансом (`DashboardController`)
- React-фронтенд визарда с Zustand-стором и базовый дашборд Creator-а
- Исправление `TenantResolver` для использования публичного API контекста

Фаза не включает: подписки и тарифные планы (Phase 5), аналитику (Phase 6), AI-интеграцию (Phase 4).

---

## Архитектура

### Общая схема Phase 3

```
┌──────────────────────────────────────────────────────────────────────┐
│                           КЛИЕНТЫ                                     │
│                                                                        │
│  Platform SPA (chatforge.app)                                          │
│  ┌─────────────────────┐   ┌──────────────────────────────────────┐   │
│  │  /builder           │   │  /dashboard                          │   │
│  │  BuilderPage        │   │  DashboardPage                       │   │
│  │  BuilderStore       │   │  (загружает данные инстанса)         │   │
│  │  (Zustand)          │   │                                      │   │
│  │  Step1..Step4       │   │  SettingsForm, AvatarUpload          │   │
│  └─────────────────────┘   └──────────────────────────────────────┘   │
│  API_Client (Axios + interceptors)                                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │           PHOENIX APPLICATION    │
              │                                  │
              │  Router                          │
              │    /api/v1/builder/*             │
              │      → BuilderController         │
              │    /api/v1/dashboard/*           │
              │      → DashboardController       │
              │                                  │
              │  ┌──────────────────────────┐    │
              │  │  ChatForge.Instances     │    │
              │  │  (bounded context)       │    │
              │  │                          │    │
              │  │  ChatInstance            │    │
              │  │  InstanceSettings        │    │
              │  │  WizardState             │    │
              │  │  S3Adapter               │    │
              │  └──────────────────────────┘    │
              │                                  │
              │  Phoenix.PubSub                  │
              │  (instance.created event)        │
              └──────────┬───────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
   ┌──────┴──┐    ┌──────┴───┐   ┌─────┴──────┐
   │PostgreSQL│    │  Redis   │   │  S3/MinIO  │
   │instances │    │  tenant  │   │  avatars/  │
   │settings  │    │  cache   │   │            │
   │wizard    │    └──────────┘   └────────────┘
   └─────────┘
```

### Ключевые архитектурные решения

**1. Bounded context Instances**
Весь код, связанный с инстансами и визардом, инкапсулирован в `ChatForge.Instances`.
Контроллеры не обращаются к `Repo` напрямую — только через публичный API контекста.
Это обеспечивает единую точку входа и упрощает тестирование.

**2. WizardState в БД**
Прогресс визарда хранится в таблице `wizard_states` (JSONB-поле `draft_settings`).
Это позволяет Creator-у продолжить визард после перезагрузки страницы или смены устройства.
При финализации `WizardState` удаляется атомарно вместе с созданием `ChatInstance`.

**3. Транзакционная финализация**
`Instances.finalize_wizard/1` выполняется в `Ecto.Multi`: создание `ChatInstance`,
создание `InstanceSettings`, удаление `WizardState`. Если любой шаг падает — вся транзакция
откатывается. PubSub-событие публикуется только после успешного коммита.

**4. S3Adapter с валидацией до загрузки**
Тип файла и размер проверяются до отправки в S3/MinIO. Это предотвращает лишние сетевые запросы
и упрощает обработку ошибок на стороне клиента.

**5. Исправление TenantResolver**
`TenantResolver` из Phase 2 обращался к `Repo` напрямую. В Phase 3 он переключается на
`Instances.get_instance_by_subdomain/1`, соблюдая границы bounded context-ов.

---

## Компоненты и интерфейсы

### Backend: ChatForge.Instances (публичный API)

```elixir
# --- ChatInstance ---

# Создание инстанса (статус draft)
Instances.create_instance(creator_id, attrs)
  → {:ok, %ChatInstance{}} | {:error, %Ecto.Changeset{}}

# Поиск по поддомену
Instances.get_instance_by_subdomain(subdomain)
  → {:ok, %ChatInstance{}} | {:error, :not_found}

# Поиск по creator_id (с предзагрузкой settings)
Instances.get_instance_by_creator(creator_id)
  → {:ok, %ChatInstance{instance_settings: %InstanceSettings{}}} | {:error, :not_found}

# Валидация поддомена
Instances.validate_subdomain(subdomain)
  → {:ok, :available} | {:error, :taken} | {:error, :invalid_format}

# --- InstanceSettings ---

# Обновление настроек
Instances.update_settings(chat_instance_id, attrs)
  → {:ok, %InstanceSettings{}} | {:error, %Ecto.Changeset{}}

# --- WizardState ---

# Получить или создать WizardState для creator_id
Instances.get_or_create_wizard_state(creator_id)
  → {:ok, %WizardState{}}

# Обновить шаг и черновик
Instances.update_wizard_step(creator_id, step, draft_attrs)
  → {:ok, %WizardState{}} | {:error, %Ecto.Changeset{}}

# Финализация: создать ChatInstance + InstanceSettings, удалить WizardState
Instances.finalize_wizard(creator_id)
  → {:ok, %ChatInstance{}} | {:error, :incomplete_wizard} | {:error, %Ecto.Changeset{}}

# --- Аватар ---

# Загрузка аватара в S3/MinIO
Instances.upload_avatar(chat_instance_id, %{path: path, content_type: type, size: size})
  → {:ok, url} | {:error, :invalid_file_type} | {:error, :file_too_large}
```

### Backend: S3Adapter

```elixir
defmodule ChatForge.Instances.S3Adapter do
  # Загружает файл в бакет, возвращает публичный URL
  def upload(key, file_path, content_type)
    → {:ok, url} | {:error, reason}
end
```

Конфигурация через `config/runtime.exs`:

```elixir
config :ex_aws,
  access_key_id:     System.get_env("AWS_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY"),
  region:            System.get_env("AWS_REGION", "us-east-1")

config :ex_aws, :s3,
  scheme: System.get_env("S3_SCHEME", "https://"),
  host:   System.get_env("S3_HOST"),
  port:   System.get_env("S3_PORT", "443") |> String.to_integer()

config :chatforge, :s3,
  bucket:     System.get_env("S3_BUCKET", "chatforge-avatars"),
  public_url: System.get_env("S3_PUBLIC_URL")
```

### Backend: Controllers

#### BuilderController — `/api/v1/builder/*`

Все маршруты требуют `AuthRequired` + `RequireRole(:creator)`.

| Метод | Путь | Действие | Описание |
|-------|------|----------|----------|
| POST | `/api/v1/builder/start` | `start` | Создать или вернуть WizardState |
| GET | `/api/v1/builder/state` | `state` | Получить текущий WizardState |
| PUT | `/api/v1/builder/step/:step` | `update_step` | Сохранить данные шага |
| POST | `/api/v1/builder/avatar` | `upload_avatar` | Загрузить аватар |
| POST | `/api/v1/builder/finalize` | `finalize` | Финализировать визард |
| GET | `/api/v1/builder/validate-subdomain` | `validate_subdomain` | Проверить поддомен |

#### DashboardController — `/api/v1/dashboard/*`

Все маршруты требуют `AuthRequired` + `RequireRole(:creator)`.

| Метод | Путь | Действие | Описание |
|-------|------|----------|----------|
| GET | `/api/v1/dashboard/instance` | `show` | Данные инстанса + settings |
| PUT | `/api/v1/dashboard/instance/settings` | `update_settings` | Обновить настройки |
| POST | `/api/v1/dashboard/instance/avatar` | `upload_avatar` | Обновить аватар |

### Backend: Router (дополнение к Phase 2)

```elixir
scope "/api/v1/builder", ChatForgeWeb do
  pipe_through [:api, :authenticated, :require_creator]

  post   "/start",               BuilderController, :start
  get    "/state",               BuilderController, :state
  put    "/step/:step",          BuilderController, :update_step
  post   "/avatar",              BuilderController, :upload_avatar
  post   "/finalize",            BuilderController, :finalize
  get    "/validate-subdomain",  BuilderController, :validate_subdomain
end

scope "/api/v1/dashboard", ChatForgeWeb do
  pipe_through [:api, :authenticated, :require_creator]

  get  "/instance",          DashboardController, :show
  put  "/instance/settings", DashboardController, :update_settings
  post "/instance/avatar",   DashboardController, :upload_avatar
end
```

### Frontend: Структура файлов

```
frontend/src/
├── features/builder/
│   ├── store.ts              # Zustand Builder Store
│   ├── api.ts                # Типизированные функции для builder-эндпоинтов
│   ├── types.ts              # WizardState, ChatInstance, InstanceSettings
│   ├── components/
│   │   ├── ProgressBar.tsx   # Прогресс-бар (1 из 4)
│   │   ├── Step1Colors.tsx   # Выбор цветовой схемы
│   │   ├── Step2Name.tsx     # Название, валюта, поддомен
│   │   ├── Step3Greeting.tsx # Аватар, приветствие, примеры вопросов
│   │   └── Step4Limit.tsx    # Лимит бесплатных сообщений
│   └── BuilderPage.tsx       # Контейнер визарда
├── features/dashboard/
│   ├── api.ts                # Типизированные функции для dashboard-эндпоинтов
│   ├── components/
│   │   ├── InstanceCard.tsx  # Карточка инстанса
│   │   └── SettingsPanel.tsx # Панель редактирования настроек
│   └── DashboardPage.tsx     # Страница дашборда
└── app/
    └── App.tsx               # Обновлённый роутинг с /builder и /dashboard
```

### Frontend: Builder Store (Zustand)

```typescript
interface BuilderState {
  currentStep: 1 | 2 | 3 | 4
  colors: {
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
  }
  name: string
  currency: 'RUB' | 'USD' | 'EUR'
  avatarUrl: string | null
  greetingText: string
  exampleQuestions: string[]
  freeMessagesLimit: number | null

  // Методы
  setStep: (step: 1 | 2 | 3 | 4) => void
  setColors: (colors: BuilderState['colors']) => void
  setNameAndCurrency: (name: string, currency: BuilderState['currency']) => void
  setGreeting: (text: string, questions: string[]) => void
  setAvatar: (url: string) => void
  setLimit: (limit: number | null) => void
  reset: () => void
}
```

---

## Модели данных

### Ecto-схема: ChatForge.Instances.ChatInstance

```elixir
schema "chat_instances" do
  field :name,                 :string
  field :subdomain,            :string
  field :currency,             :string, default: "RUB"
  field :status,               :string, default: "draft"
  field :free_messages_limit,  :integer

  belongs_to :creator,          ChatForge.Accounts.User, foreign_key: :creator_id
  has_one    :instance_settings, ChatForge.Instances.InstanceSettings

  timestamps()
end

def changeset(chat_instance, attrs) do
  chat_instance
  |> cast(attrs, [:creator_id, :name, :subdomain, :currency, :status, :free_messages_limit])
  |> validate_required([:creator_id, :name, :subdomain, :currency])
  |> validate_format(:subdomain, ~r/^[a-z0-9-]+$/)
  |> validate_inclusion(:status, ["draft", "active", "suspended"])
  |> validate_inclusion(:currency, ["RUB", "USD", "EUR"])
  |> unique_constraint(:subdomain)
end
```

### Ecto-схема: ChatForge.Instances.InstanceSettings

```elixir
schema "instance_settings" do
  field :primary_color,    :string
  field :secondary_color,  :string
  field :background_color, :string
  field :avatar_url,       :string
  field :greeting_text,    :string
  field :example_questions, {:array, :string}, default: []
  field :system_prompt,    :string

  belongs_to :chat_instance, ChatForge.Instances.ChatInstance

  timestamps()
end

def changeset(settings, attrs) do
  settings
  |> cast(attrs, [:chat_instance_id, :primary_color, :secondary_color,
                  :background_color, :avatar_url, :greeting_text,
                  :example_questions, :system_prompt])
  |> validate_required([:chat_instance_id])
  |> validate_format(:primary_color,    ~r/^#[0-9A-Fa-f]{6}$/)
  |> validate_format(:secondary_color,  ~r/^#[0-9A-Fa-f]{6}$/)
  |> validate_format(:background_color, ~r/^#[0-9A-Fa-f]{6}$/)
  |> validate_length(:greeting_text, max: 1000)
end
```

### Ecto-схема: ChatForge.Instances.WizardState

```elixir
schema "wizard_states" do
  field :current_step,   :integer, default: 1
  field :draft_settings, :map,     default: %{}

  belongs_to :creator, ChatForge.Accounts.User, foreign_key: :creator_id

  timestamps()
end

def changeset(wizard_state, attrs) do
  wizard_state
  |> cast(attrs, [:creator_id, :current_step, :draft_settings])
  |> validate_required([:creator_id])
  |> validate_inclusion(:current_step, 1..4)
  |> unique_constraint(:creator_id)
end
```

### Миграции БД

```sql
-- chat_instances
CREATE TABLE chat_instances (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  subdomain            VARCHAR(63) NOT NULL UNIQUE,
  currency             VARCHAR(10) NOT NULL DEFAULT 'RUB',
  status               VARCHAR(20) NOT NULL DEFAULT 'draft',
  free_messages_limit  INTEGER,
  inserted_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_instances_creator_id ON chat_instances(creator_id);

-- instance_settings
CREATE TABLE instance_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id  UUID NOT NULL REFERENCES chat_instances(id) ON DELETE CASCADE,
  primary_color     VARCHAR(7),
  secondary_color   VARCHAR(7),
  background_color  VARCHAR(7),
  avatar_url        TEXT,
  greeting_text     TEXT,
  example_questions JSONB DEFAULT '[]',
  system_prompt     TEXT,
  inserted_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_instance_settings_instance_id ON instance_settings(chat_instance_id);

-- wizard_states
CREATE TABLE wizard_states (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step   INTEGER NOT NULL DEFAULT 1,
  draft_settings JSONB NOT NULL DEFAULT '{}',
  inserted_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_wizard_states_creator_id ON wizard_states(creator_id);
```

### API Response форматы

**WizardState (GET /api/v1/builder/state):**
```json
{
  "wizard_state": {
    "current_step": 2,
    "draft_settings": {
      "primary_color": "#6366F1",
      "secondary_color": "#8B5CF6",
      "background_color": "#F8FAFC"
    }
  }
}
```

**ChatInstance после финализации (POST /api/v1/builder/finalize):**
```json
{
  "chat_instance": {
    "id": "uuid",
    "name": "Мой чат",
    "subdomain": "my-chat",
    "currency": "RUB",
    "status": "active",
    "free_messages_limit": 10,
    "public_url": "https://my-chat.chatforge.app",
    "settings": {
      "primary_color": "#6366F1",
      "secondary_color": "#8B5CF6",
      "background_color": "#F8FAFC",
      "avatar_url": "https://s3.example.com/avatars/uuid.jpg",
      "greeting_text": "Привет! Чем могу помочь?",
      "example_questions": ["Что ты умеешь?", "Как начать?"]
    }
  }
}
```

**Ошибка валидации (HTTP 422):**
```json
{
  "errors": {
    "subdomain": ["has invalid format"],
    "primary_color": ["has invalid format"]
  }
}
```

**Ошибка файла (HTTP 422):**
```json
{
  "error": "file_too_large"
}
```

---

## Свойства корректности

*Свойство — это характеристика или поведение, которое должно выполняться при всех допустимых выполнениях системы. По сути, это формальное утверждение о том, что система должна делать. Свойства служат мостом между читаемыми человеком спецификациями и машинно-верифицируемыми гарантиями корректности.*

### Свойство 1: Инвариант формата поддомена в changeset

*Для любой* строки, содержащей хотя бы один символ вне `[a-z0-9-]`, changeset `ChatInstance` должен быть невалидным с ошибкой на поле `subdomain`. Обратное: для любой строки, содержащей только символы `[a-z0-9-]`, changeset должен проходить валидацию формата поддомена.

**Validates: Requirements 1.4, 1.8**

### Свойство 2: Инвариант формата цвета в changeset InstanceSettings

*Для любой* строки, не соответствующей паттерну `#RRGGBB` (6 hex-символов с `#`), changeset `InstanceSettings` должен быть невалидным с ошибкой на соответствующем цветовом поле. Для любой строки вида `#[0-9A-Fa-f]{6}` — проходить валидацию.

**Validates: Requirements 1.5**

### Свойство 3: Инвариант диапазона current_step в WizardState

*Для любого* целого числа вне диапазона `[1, 4]`, changeset `WizardState` должен быть невалидным с ошибкой на поле `current_step`. Для любого числа из `{1, 2, 3, 4}` — проходить валидацию.

**Validates: Requirements 1.6**

### Свойство 4: Создание инстанса — инвариант статуса draft

*Для любого* валидного `creator_id` и валидного набора атрибутов, `Instances.create_instance/2` должен возвращать `{:ok, instance}`, где `instance.status == "draft"`. Для любых невалидных данных — возвращать `{:error, changeset}` без создания записи в БД.

**Validates: Requirements 2.1, 2.2**

### Свойство 5: Round-trip — создание и поиск инстанса по поддомену

*Для любого* валидного поддомена `sub`: если `Instances.create_instance/2` вернул `{:ok, instance}` с `instance.subdomain == sub`, то `Instances.get_instance_by_subdomain(sub)` должен вернуть `{:ok, instance}` с теми же данными. Для любого поддомена, не существующего в БД, должен возвращаться `{:error, :not_found}`.

**Validates: Requirements 2.3, 2.4**

### Свойство 6: Round-trip — создание инстанса и поиск по creator_id

*Для любого* `creator_id`, у которого создан `ChatInstance`, `Instances.get_instance_by_creator/1` должен возвращать `{:ok, instance}` с предзагруженными `instance_settings`. Для `creator_id` без инстанса — `{:error, :not_found}`.

**Validates: Requirements 2.5, 2.6**

### Свойство 7: Комплексная валидация поддомена

*Для любой* строки с символами вне `[a-z0-9-]`, `Instances.validate_subdomain/1` должен возвращать `{:error, :invalid_format}`. Для любого валидного поддомена, уже существующего в БД, — `{:error, :taken}`. Для любого валидного поддомена, не существующего в БД, — `{:ok, :available}`.

**Validates: Requirements 2.9, 2.10, 2.11**

### Свойство 8: Инвариант финализации визарда

*Для любого* `creator_id` с полным `WizardState`: после успешного вызова `Instances.finalize_wizard/1` должны выполняться одновременно: (1) возвращается `{:ok, instance}` с `instance.status == "active"`, (2) `WizardState` для этого `creator_id` отсутствует в БД, (3) `ChatInstance` существует в БД. Для неполного `WizardState` — возвращается `{:error, :incomplete_wizard}` без изменений в БД.

**Validates: Requirements 2.12, 2.14**

### Свойство 9: PubSub-событие при финализации

*Для любого* `creator_id` с полным `WizardState`: после успешного вызова `Instances.finalize_wizard/1` в топике PubSub должно быть опубликовано событие `instance.created` с данными созданного инстанса.

**Validates: Requirements 2.13**

### Свойство 10: Валидация файла аватара — тип и размер

*Для любого* файла с MIME-типом вне `["image/jpeg", "image/png", "image/webp"]`, `Instances.upload_avatar/2` должен возвращать `{:error, :invalid_file_type}` без обращения к S3. *Для любого* файла размером строго больше 5 242 880 байт (5 МБ), независимо от типа, — `{:error, :file_too_large}` без обращения к S3.

**Validates: Requirements 3.3, 3.4**

### Свойство 11: Идемпотентность старта визарда

*Для любого* `creator_id`: повторный вызов `POST /api/v1/builder/start` должен возвращать HTTP 200 с тем же `WizardState`, что и при первом вызове (HTTP 201). В БД не должна создаваться вторая запись `WizardState` для того же `creator_id`.

**Validates: Requirements 4.2**

### Свойство 12: Сохранение данных при навигации по шагам визарда

*Для любой* последовательности переходов между шагами (вперёд и назад): данные, сохранённые в `Builder_Store` на шаге N, должны присутствовать в сторе при возврате на шаг N без изменений.

**Validates: Requirements 6.3**

### Свойство 13: Изоляция Creator-ов

*Для любых* двух Creator-ов `A` и `B`: `Instances.get_instance_by_creator(A.id)` никогда не должен возвращать инстанс, принадлежащий `B` (т.е. где `creator_id == B.id`).

**Validates: Requirements 5.8**

---

## Обработка ошибок

### Backend: стратегия ответов

Все ошибки возвращаются в едином JSON-формате (унаследован из Phase 2):

```json
// Ошибки валидации (HTTP 422)
{ "errors": { "field": ["message"] } }

// Бизнес-ошибки (HTTP 422)
{ "error": "file_too_large" }
{ "error": "invalid_file_type" }
{ "error": "subdomain_taken" }
{ "error": "subdomain_invalid_format" }
{ "error": "incomplete_wizard" }

// Не найдено (HTTP 404)
{ "error": "not_found" }

// Не авторизован (HTTP 401)
{ "error": "unauthorized" }

// Запрещено (HTTP 403)
{ "error": "forbidden" }
```

### Обработка ошибок по компонентам

**Instances.create_instance/2:**
- Невалидный changeset → `{:error, changeset}` → HTTP 422 с полями ошибок.
- Дублирующийся `subdomain` → ошибка уникального ограничения → HTTP 422.

**Instances.finalize_wizard/1:**
- Неполный `WizardState` (отсутствуют обязательные поля в `draft_settings`) → `{:error, :incomplete_wizard}` → HTTP 422.
- Ошибка в `Ecto.Multi` (например, subdomain занят к моменту финализации) → транзакция откатывается → `{:error, changeset}` → HTTP 422.
- PubSub-событие публикуется только после успешного коммита транзакции.

**S3Adapter.upload/3:**
- Ошибка сети или S3 → `{:error, reason}` → HTTP 500 с `{"error": "upload_failed"}`.
- Валидация типа/размера выполняется до вызова S3Adapter — ошибки возвращаются как HTTP 422.

**TenantResolver (исправление):**
- Вызывает `Instances.get_instance_by_subdomain/1`.
- `{:error, :not_found}` → HTTP 404.
- Ошибка Redis → fallback на вызов `Instances.get_instance_by_subdomain/1` (без кеша).

**BuilderController:**
- Шаг с невалидными данными → HTTP 422 с описанием ошибок.
- Запрос без токена → HTTP 401 (через `AuthRequired` Plug).
- Запрос с токеном не-Creator-а → HTTP 403 (через `RequireRole` Plug).

**DashboardController:**
- Creator без инстанса → HTTP 404.
- Попытка доступа к чужому инстансу → HTTP 403 (проверка `instance.creator_id == current_user.id`).

### Frontend: обработка ошибок

**Builder Store / API:**
- Ошибки HTTP 422 отображаются рядом с соответствующими полями через `react-hook-form` `setError`.
- Ошибки HTTP 500 отображаются через toast-уведомления (Sonner).
- При ошибке на любом шаге переход к следующему шагу блокируется.

**Subdomain validation (debounce):**
- `{:error, :taken}` → сообщение "Поддомен уже занят" рядом с полем.
- `{:error, :invalid_format}` → сообщение "Только строчные буквы, цифры и дефис".
- Ошибка сети → сообщение "Не удалось проверить поддомен, попробуйте позже".

**Роутинг:**
- Creator без завершённого визарда при переходе на `/dashboard` → редирект на `/builder`.
- Creator с завершённым визардом при переходе на `/builder` → редирект на `/dashboard`.

---

## Стратегия тестирования

### Подход

**Два уровня тестов:**
- **Unit/Integration тесты** — конкретные примеры: HTTP-статусы, структуры ответов, граничные случаи.
- **Property-based тесты** — универсальные свойства: корректность для любых валидных/невалидных входных данных.

Unit-тесты фокусируются на конкретных примерах и интеграционных точках. Property-тесты покрывают широкий диапазон входных данных через рандомизацию.

### Backend: Property-based тесты (StreamData)

Библиотека: [`stream_data`](https://hex.pm/packages/stream_data).
Минимум 100 итераций на каждый property-тест.

```elixir
# Feature: chatforge-phase-3, Property 1: subdomain format invariant
property "changeset невалиден для поддомена с недопустимыми символами" do
  check all invalid_char <- StreamData.string(:printable)
                            |> StreamData.filter(&String.match?(&1, ~r/[^a-z0-9-]/)),
            prefix <- StreamData.string(:alphanumeric, min_length: 1),
            max_runs: 100 do
    subdomain = prefix <> invalid_char
    changeset = ChatInstance.changeset(%ChatInstance{}, %{
      creator_id: Ecto.UUID.generate(),
      name: "Test",
      subdomain: subdomain,
      currency: "RUB"
    })
    refute changeset.valid?
    assert Keyword.has_key?(changeset.errors, :subdomain)
  end
end

# Feature: chatforge-phase-3, Property 2: color format invariant
property "changeset невалиден для цвета в неверном формате" do
  check all color <- StreamData.string(:printable)
                     |> StreamData.filter(&(not String.match?(&1, ~r/^#[0-9A-Fa-f]{6}$/))),
            max_runs: 100 do
    changeset = InstanceSettings.changeset(%InstanceSettings{}, %{
      chat_instance_id: Ecto.UUID.generate(),
      primary_color: color
    })
    refute changeset.valid?
    assert Keyword.has_key?(changeset.errors, :primary_color)
  end
end

# Feature: chatforge-phase-3, Property 3: current_step range invariant
property "changeset невалиден для current_step вне диапазона [1,4]" do
  check all step <- StreamData.integer()
                    |> StreamData.filter(&(&1 < 1 or &1 > 4)),
            max_runs: 100 do
    changeset = WizardState.changeset(%WizardState{}, %{
      creator_id: Ecto.UUID.generate(),
      current_step: step
    })
    refute changeset.valid?
    assert Keyword.has_key?(changeset.errors, :current_step)
  end
end

# Feature: chatforge-phase-3, Property 4: create_instance status draft invariant
property "create_instance всегда создаёт инстанс со статусом draft" do
  check all name      <- StreamData.string(:alphanumeric, min_length: 1, max_length: 50),
            subdomain <- StreamData.string(:alphanumeric, min_length: 3, max_length: 20)
                         |> StreamData.map(&String.downcase/1),
            max_runs: 100 do
    creator = insert_creator()
    case Instances.create_instance(creator.id, %{name: name, subdomain: subdomain, currency: "RUB"}) do
      {:ok, instance} -> assert instance.status == "draft"
      {:error, _}     -> :ok  # дубликат поддомена — допустимо
    end
  end
end

# Feature: chatforge-phase-3, Property 5: create then get_by_subdomain round-trip
property "create_instance затем get_instance_by_subdomain возвращает тот же инстанс" do
  check all subdomain <- StreamData.string(:alphanumeric, min_length: 3, max_length: 20)
                         |> StreamData.map(&String.downcase/1)
                         |> StreamData.filter(&(not subdomain_exists?(&1))),
            max_runs: 100 do
    creator = insert_creator()
    {:ok, instance} = Instances.create_instance(creator.id, %{
      name: "Test", subdomain: subdomain, currency: "RUB"
    })
    assert {:ok, found} = Instances.get_instance_by_subdomain(subdomain)
    assert found.id == instance.id
    assert found.subdomain == subdomain
  end
end

# Feature: chatforge-phase-3, Property 7: validate_subdomain comprehensive
property "validate_subdomain корректно различает invalid_format, taken и available" do
  check all subdomain <- StreamData.string(:printable, min_length: 1),
            max_runs: 100 do
    result = Instances.validate_subdomain(subdomain)
    cond do
      not String.match?(subdomain, ~r/^[a-z0-9-]+$/) ->
        assert result == {:error, :invalid_format}
      subdomain_exists?(subdomain) ->
        assert result == {:error, :taken}
      true ->
        assert result == {:ok, :available}
    end
  end
end

# Feature: chatforge-phase-3, Property 8: finalize_wizard invariant
property "finalize_wizard создаёт active инстанс и удаляет WizardState" do
  check all name      <- StreamData.string(:alphanumeric, min_length: 1, max_length: 50),
            subdomain <- StreamData.string(:alphanumeric, min_length: 3, max_length: 20)
                         |> StreamData.map(&String.downcase/1)
                         |> StreamData.filter(&(not subdomain_exists?(&1))),
            max_runs: 100 do
    creator = insert_creator()
    setup_complete_wizard_state(creator.id, name, subdomain)
    assert {:ok, instance} = Instances.finalize_wizard(creator.id)
    assert instance.status == "active"
    assert {:error, :not_found} = Instances.get_wizard_state(creator.id)
    assert {:ok, _} = Instances.get_instance_by_subdomain(subdomain)
  end
end

# Feature: chatforge-phase-3, Property 10: file validation — type and size
property "upload_avatar отклоняет файлы с недопустимым типом" do
  check all content_type <- StreamData.member_of([
                              "application/pdf", "image/gif", "text/plain",
                              "video/mp4", "application/octet-stream"
                            ]),
            max_runs: 100 do
    instance = insert_instance_with_settings()
    result = Instances.upload_avatar(instance.id, %{
      path: "/tmp/test_file",
      content_type: content_type,
      size: 1024
    })
    assert result == {:error, :invalid_file_type}
  end
end

property "upload_avatar отклоняет файлы размером > 5 МБ" do
  check all size <- StreamData.integer(min: 5_242_881, max: 100_000_000),
            content_type <- StreamData.member_of(["image/jpeg", "image/png", "image/webp"]),
            max_runs: 100 do
    instance = insert_instance_with_settings()
    result = Instances.upload_avatar(instance.id, %{
      path: "/tmp/test_file",
      content_type: content_type,
      size: size
    })
    assert result == {:error, :file_too_large}
  end
end

# Feature: chatforge-phase-3, Property 11: builder/start idempotency
property "повторный POST /api/v1/builder/start возвращает тот же WizardState" do
  check all _unused <- StreamData.constant(nil), max_runs: 100 do
    creator = insert_creator()
    conn1 = authenticated_post(creator, "/api/v1/builder/start", %{})
    conn2 = authenticated_post(creator, "/api/v1/builder/start", %{})
    assert conn1.status == 201
    assert conn2.status == 200
    body1 = Jason.decode!(conn1.resp_body)
    body2 = Jason.decode!(conn2.resp_body)
    assert body1["wizard_state"]["id"] == body2["wizard_state"]["id"]
    assert Repo.aggregate(WizardState, :count, :id,
             where: [creator_id: creator.id]) == 1
  end
end

# Feature: chatforge-phase-3, Property 13: creator isolation
property "get_instance_by_creator никогда не возвращает чужой инстанс" do
  check all _unused <- StreamData.constant(nil), max_runs: 100 do
    creator_a = insert_creator()
    creator_b = insert_creator()
    {:ok, instance_a} = insert_instance_for(creator_a)
    {:ok, instance_b} = insert_instance_for(creator_b)
    {:ok, found_a} = Instances.get_instance_by_creator(creator_a.id)
    {:ok, found_b} = Instances.get_instance_by_creator(creator_b.id)
    assert found_a.id == instance_a.id
    assert found_b.id == instance_b.id
    refute found_a.id == instance_b.id
    refute found_b.id == instance_a.id
  end
end
```

### Backend: Unit/Integration тесты (ExUnit)

```elixir
# Instances context
describe "Instances" do
  test "create_instance/2 создаёт инстанс со статусом draft"
  test "create_instance/2 возвращает {:error, changeset} при дублирующемся subdomain"
  test "get_instance_by_subdomain/1 возвращает {:error, :not_found} для несуществующего поддомена"
  test "get_instance_by_creator/1 предзагружает instance_settings"
  test "update_settings/2 обновляет поля и возвращает {:ok, settings}"
  test "finalize_wizard/1 возвращает {:error, :incomplete_wizard} при неполном WizardState"
  test "finalize_wizard/1 публикует событие instance.created через PubSub"
  test "upload_avatar/2 обновляет avatar_url в InstanceSettings после успешной загрузки"
end

# BuilderController
describe "POST /api/v1/builder/start" do
  test "возвращает 201 с WizardState при первом вызове"
  test "возвращает 200 с существующим WizardState при повторном вызове"
  test "возвращает 401 без Authorization header"
  test "возвращает 403 для пользователя с ролью end_user"
end

describe "PUT /api/v1/builder/step/1" do
  test "возвращает 200 и обновляет draft_settings с цветами"
  test "возвращает 422 при невалидном формате цвета"
  test "обновляет current_step до 2"
end

describe "PUT /api/v1/builder/step/2" do
  test "возвращает 200 при валидном и доступном поддомене"
  test "возвращает 422 при занятом поддомене"
  test "возвращает 422 при поддомене с недопустимыми символами"
end

describe "POST /api/v1/builder/finalize" do
  test "возвращает 201 с ChatInstance при полном WizardState"
  test "возвращает 422 при неполном WizardState"
  test "созданный инстанс имеет статус active"
end

describe "GET /api/v1/builder/validate-subdomain" do
  test "возвращает {available: true} для свободного поддомена"
  test "возвращает {available: false, reason: taken} для занятого поддомена"
  test "возвращает {available: false, reason: invalid_format} для невалидного поддомена"
end

# DashboardController
describe "GET /api/v1/dashboard/instance" do
  test "возвращает 200 с инстансом и settings"
  test "возвращает 404 если инстанс не создан"
  test "возвращает 401 без токена"
end

describe "PUT /api/v1/dashboard/instance/settings" do
  test "возвращает 200 с обновлёнными settings"
  test "возвращает 422 при невалидных данных"
  test "возвращает 403 при попытке обновить чужой инстанс"
end
```

### Frontend: тесты (Vitest + Testing Library)

```typescript
// Feature: chatforge-phase-3, Property 12: builder store navigation persistence
test('Builder Store сохраняет данные шага при переходе назад', () => {
  const store = useBuilderStore.getState()
  store.setColors({ primaryColor: '#6366F1', secondaryColor: '#8B5CF6', backgroundColor: '#F8FAFC' })
  store.setStep(2)
  store.setStep(1)
  expect(store.colors.primaryColor).toBe('#6366F1')
})

// Subdomain validation debounce
test('Step2 показывает ошибку при занятом поддомене', async () => {
  server.use(rest.get('/api/v1/builder/validate-subdomain', (req, res, ctx) =>
    res(ctx.json({ available: false, reason: 'taken' }))
  ))
  render(<Step2Name />)
  await userEvent.type(screen.getByRole('textbox', { name: /название/i }), 'my-chat')
  await waitFor(() => {
    expect(screen.getByText(/поддомен уже занят/i)).toBeInTheDocument()
  })
})

// Routing guard
test('/dashboard перенаправляет на /builder если визард не завершён', () => {
  renderWithRouter(<App />, { initialEntries: ['/dashboard'] })
  expect(window.location.pathname).toBe('/builder')
})

// Finalize
test('нажатие "Завершить" вызывает POST /api/v1/builder/finalize и показывает success screen', async () => {
  server.use(rest.post('/api/v1/builder/finalize', (req, res, ctx) =>
    res(ctx.status(201), ctx.json({ chat_instance: { subdomain: 'my-chat', status: 'active' } }))
  ))
  render(<Step4Limit />)
  await userEvent.click(screen.getByRole('button', { name: /завершить/i }))
  await waitFor(() => {
    expect(screen.getByText(/ваш чат создан/i)).toBeInTheDocument()
  })
})
```

### Запуск тестов

```bash
# Backend (одиночный запуск)
mix test

# Frontend (одиночный запуск)
cd frontend && npx vitest --run
```
