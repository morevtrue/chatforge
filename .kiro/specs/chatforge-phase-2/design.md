# Дизайн — ChatForge Phase 2: Аутентификация

## Обзор

Phase 2 реализует полный цикл аутентификации для двух типов пользователей ChatForge:
- **Creator** — пользователь платформы, регистрируется на `chatforge.app`.
- **End User** — конечный пользователь чат-инстанса, регистрируется на `<subdomain>.chatforge.app`.

После завершения фазы:
- Creator может зарегистрироваться, войти, выйти и получить свой профиль через REST API.
- End User может зарегистрироваться и войти в рамках своего тенанта.
- JWT access-токены (TTL 15 мин) и refresh-токены (TTL 30 дней, хранятся в Redis) работают корректно.
- Tenant резолвится по поддомену через `TenantResolver` Plug с кешированием в Redis.
- Фронтенд хранит access-токен в памяти, refresh-токен в httpOnly cookie, автоматически обновляет токены.
- Защищённые маршруты закрыты через `AuthRequired` и `RequireRole` Plug-и.

Фаза не включает: OAuth, социальные логины, восстановление пароля, визард создания чата, AI-интеграцию, подписки.

---

## Архитектура

### Общая схема Phase 2

```
┌─────────────────────────────────────────────────────────────────┐
│                        КЛИЕНТЫ                                   │
│                                                                   │
│  Platform SPA (chatforge.app)    Chat SPA (<sub>.chatforge.app)  │
│  Creator_Auth_Store (Zustand)    EndUser_Auth_Store (Zustand)    │
│  API_Client (Axios + interceptors)                               │
└──────────────────────┬──────────────────────┬───────────────────┘
                       │                      │
              ┌────────┴──────────────────────┴────────┐
              │              TRAEFIK                    │
              │  (поддомены → Phoenix)                  │
              └────────────────────┬────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │           PHOENIX APPLICATION            │
              │                                          │
              │  Router                                  │
              │    pipeline :api                         │
              │    pipeline :authenticated               │
              │      └─ AuthRequired Plug                │
              │    pipeline :chat_tenant                 │
              │      └─ TenantResolver Plug              │
              │                                          │
              │  /api/v1/auth/*   → AuthController       │
              │  /api/v1/chat/auth/* → ChatAuthController│
              │                                          │
              │  ┌──────────────┐  ┌──────────────────┐ │
              │  │   Accounts   │  │      Chat        │ │
              │  │  (Creator)   │  │   (End User)     │ │
              │  └──────────────┘  └──────────────────┘ │
              │                                          │
              │  ChatForge.Guardian (JWT + Redis)        │
              └──────────────┬───────────────────────────┘
                             │
               ┌─────────────┼──────────┐
               │             │          │
        ┌──────┴──┐   ┌──────┴───┐      │
        │PostgreSQL│   │  Redis   │      │
        │  users   │   │ refresh  │      │
        │ end_users│   │  tokens  │      │
        └─────────┘   │  tenant  │      │
                      │  cache   │      │
                      └──────────┘      │
```

### Ключевые архитектурные решения

**1. Два независимых типа пользователей**
Creator-ы хранятся в `users` (контекст `Accounts`), End User-ы — в `end_users` (контекст `Chat`). Это разные Ecto-схемы, разные контексты, разные JWT-субъекты. Смешение невозможно на уровне архитектуры.

**2. JWT с ротацией refresh-токенов**
Access-токен — короткоживущий JWT (15 мин), передаётся в `Authorization: Bearer` header. Refresh-токен — долгоживущий (30 дней), хранится в Redis по ключу `{user_id}:refresh:{token_hash}`. При каждом обновлении старый refresh-токен инвалидируется (ротация), что предотвращает повторное использование.

**3. TenantResolver с Redis-кешем**
Поддомен из Host header → поиск `ChatInstance` в БД → кеш в Redis (`tenant:<subdomain>`, TTL 5 мин). Это снижает нагрузку на БД при каждом запросе к чат-инстансу.

**4. Access-токен только в памяти**
Фронтенд хранит access-токен исключительно в памяти (Zustand store), не в `localStorage`/`sessionStorage`. Refresh-токен — в httpOnly cookie (недоступен из JS). Это защищает от XSS-атак.

---

## Компоненты и интерфейсы

### Backend: Bounded Contexts

#### ChatForge.Accounts

Публичный API контекста:

```elixir
# Регистрация Creator-а
Accounts.register_creator(%{email, password, name, phone?, telegram?})
  → {:ok, %User{}} | {:error, %Ecto.Changeset{}}

# Аутентификация
Accounts.authenticate(email, password)
  → {:ok, %User{}} | {:error, :invalid_credentials}

# Получение пользователя
Accounts.get_user!(id)       → %User{} | raise Ecto.NoResultsError
Accounts.get_user_by_email(email) → %User{} | nil

# Хэширование пароля (внутренняя функция)
Accounts.hash_password(password) → hash_string
```

#### ChatForge.Chat (End User часть)

```elixir
# Регистрация End User-а
Chat.register_end_user(tenant_id, %{email, password, name})
  → {:ok, %EndUser{}} | {:error, %Ecto.Changeset{}}

# Аутентификация End User-а
Chat.authenticate_end_user(tenant_id, email, password)
  → {:ok, %EndUser{}} | {:error, :invalid_credentials}
```

#### ChatForge.Guardian

```elixir
# Создание пары токенов
Guardian.create_tokens(user_or_end_user)
  → {:ok, access_token, refresh_token}

# Обновление токенов (ротация)
Guardian.refresh_tokens(refresh_token)
  → {:ok, access_token, refresh_token} | {:error, :invalid_token}

# Отзыв refresh-токена
Guardian.revoke_refresh_token(refresh_token)
  → {:ok} | {:error, reason}
```

### Backend: Plugs

#### ChatForgeWeb.Plugs.AuthRequired

```elixir
# Проверяет Authorization: Bearer <token>
# При успехе: conn.assigns.current_user = %User{} или %EndUser{}
# При ошибке: halt с HTTP 401
```

#### ChatForgeWeb.Plugs.RequireRole

```elixir
# Проверяет conn.assigns.current_user.role == required_role
# При успехе: пропускает запрос
# При ошибке: halt с HTTP 403
```

#### ChatForgeWeb.Plugs.TenantResolver

```elixir
# Извлекает поддомен из Host header
# Ищет ChatInstance в Redis (кеш) или БД
# При успехе: conn.assigns.tenant_id, conn.assigns.chat_instance
# При ошибке: halt с HTTP 404
```

### Backend: Controllers

#### ChatForgeWeb.AuthController

| Метод | Путь | Действие |
|-------|------|----------|
| POST | `/api/v1/auth/register` | Регистрация Creator-а |
| POST | `/api/v1/auth/login` | Вход Creator-а |
| POST | `/api/v1/auth/logout` | Выход (отзыв refresh-токена) |
| POST | `/api/v1/auth/refresh` | Обновление токенов |
| GET | `/api/v1/auth/me` | Профиль текущего Creator-а |

#### ChatForgeWeb.ChatAuthController

| Метод | Путь | Действие |
|-------|------|----------|
| POST | `/api/v1/chat/auth/register` | Регистрация End User-а |
| POST | `/api/v1/chat/auth/login` | Вход End User-а |
| POST | `/api/v1/chat/auth/logout` | Выход End User-а |
| GET | `/api/v1/chat/auth/me` | Профиль текущего End User-а |

### Backend: Router pipelines

```elixir
pipeline :api do
  plug :accepts, ["json"]
  plug CORSPlug
end

pipeline :authenticated do
  plug ChatForgeWeb.Plugs.AuthRequired
end

pipeline :chat_tenant do
  plug ChatForgeWeb.Plugs.TenantResolver
end

# Публичные маршруты Creator-а
scope "/api/v1/auth", ChatForgeWeb do
  pipe_through :api
  post "/register", AuthController, :register
  post "/login",    AuthController, :login
  post "/refresh",  AuthController, :refresh
end

# Защищённые маршруты Creator-а
scope "/api/v1/auth", ChatForgeWeb do
  pipe_through [:api, :authenticated]
  post "/logout", AuthController, :logout
  get  "/me",     AuthController, :me
end

# Маршруты End User-а (требуют тенант)
scope "/api/v1/chat/auth", ChatForgeWeb do
  pipe_through [:api, :chat_tenant]
  post "/register", ChatAuthController, :register
  post "/login",    ChatAuthController, :login
  post "/refresh",  ChatAuthController, :refresh
end

scope "/api/v1/chat/auth", ChatForgeWeb do
  pipe_through [:api, :chat_tenant, :authenticated]
  post "/logout", ChatAuthController, :logout
  get  "/me",     ChatAuthController, :me
end
```

### Frontend: Структура файлов

```
frontend/src/
├── features/auth/
│   ├── api.ts              # Типизированные функции для auth-эндпоинтов
│   ├── creatorAuthStore.ts # Zustand-стор Creator-а
│   ├── endUserAuthStore.ts # Zustand-стор End User-а
│   └── types.ts            # Типы: User, EndUser, AuthResponse
├── shared/lib/
│   └── api.ts              # Axios-инстанс с интерцепторами
├── pages/platform/auth/
│   ├── LoginPage.tsx       # Страница входа Creator-а
│   └── RegisterPage.tsx    # Страница регистрации Creator-а
├── pages/chat/auth/
│   ├── ChatLoginPage.tsx   # Страница входа End User-а
│   └── ChatRegisterPage.tsx# Страница регистрации End User-а
└── app/
    └── App.tsx             # Роутинг с ProtectedRoute
```

### Frontend: API Client

```typescript
// shared/lib/api.ts — Axios с интерцепторами
// Request interceptor: добавляет Authorization: Bearer <accessToken>
// Response interceptor: при 401 → POST /auth/refresh → повтор запроса
//                       при ошибке refresh → очистка стора → редирект на /login
```

### Frontend: Auth Stores (Zustand)

```typescript
// Creator Auth Store
interface CreatorAuthState {
  currentUser: User | null
  isAuthenticated: boolean
  accessToken: string | null
  login: (credentials) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User, token: string) => void
}

// End User Auth Store (полностью изолирован)
interface EndUserAuthState {
  currentEndUser: EndUser | null
  isAuthenticated: boolean
  accessToken: string | null
  login: (credentials) => Promise<void>
  logout: () => Promise<void>
}
```

---

## Модели данных

### Ecto-схема: ChatForge.Accounts.User

Таблица `users` (создана в Phase 1, используется как есть):

```elixir
schema "users" do
  field :email,         :string
  field :password_hash, :string
  field :name,          :string
  field :phone,         :string
  field :telegram,      :string
  field :role,          :string, default: "creator"
  # virtual field, не хранится в БД
  field :password,      :string, virtual: true
  timestamps()
end
```

Changesets:

```elixir
# Регистрация
def registration_changeset(user, attrs) do
  user
  |> cast(attrs, [:email, :password, :name, :phone, :telegram])
  |> validate_required([:email, :password, :name])
  |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/)
  |> validate_length(:password, min: 8)
  |> unique_constraint(:email)
  |> put_password_hash()
end

# Логин (только для валидации входных данных)
def login_changeset(user, attrs) do
  user
  |> cast(attrs, [:email, :password])
  |> validate_required([:email, :password])
end
```

### Ecto-схема: ChatForge.Chat.EndUser

Таблица `end_users` (создана в Phase 1):

```elixir
schema "end_users" do
  field :email,            :string
  field :password_hash,    :string
  field :name,             :string
  field :messages_used,    :integer, default: 0
  field :password,         :string, virtual: true
  belongs_to :chat_instance, ChatForge.Instances.ChatInstance
  timestamps()
end
```

Changeset регистрации:

```elixir
def registration_changeset(end_user, attrs, tenant_id) do
  end_user
  |> cast(attrs, [:email, :password, :name])
  |> validate_required([:email, :password, :name])
  |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/)
  |> validate_length(:password, min: 8)
  |> put_change(:chat_instance_id, tenant_id)
  |> unique_constraint(:email, name: :end_users_email_instance_index)
  |> put_password_hash()
end
```

### Redis: структура ключей

| Ключ | Значение | TTL | Назначение |
|------|----------|-----|------------|
| `{user_id}:refresh:{token_hash}` | `"1"` | 30 дней | Refresh-токен Creator-а |
| `{end_user_id}:refresh:{token_hash}` | `"1"` | 30 дней | Refresh-токен End User-а |
| `tenant:{subdomain}` | JSON `ChatInstance` | 5 минут | Кеш тенанта |

### JWT Claims

```json
{
  "sub": "user_uuid",
  "typ": "access",
  "role": "creator",
  "iss": "chatforge",
  "exp": 1234567890
}
```

Для End User добавляется `tenant_id`:

```json
{
  "sub": "end_user_uuid",
  "typ": "access",
  "role": "end_user",
  "tenant_id": "chat_instance_uuid",
  "iss": "chatforge",
  "exp": 1234567890
}
```

### API Response форматы

**Успешная аутентификация Creator-а:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Имя",
    "role": "creator"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

**Ошибка валидации (HTTP 422):**
```json
{
  "errors": {
    "email": ["has already been taken"],
    "password": ["should be at least 8 character(s)"]
  }
}
```

**Ошибка аутентификации (HTTP 401):**
```json
{
  "error": "invalid_credentials"
}
```

---


## Свойства корректности

*Свойство — это характеристика или поведение, которое должно выполняться при всех допустимых выполнениях системы. По сути, это формальное утверждение о том, что система должна делать. Свойства служат мостом между читаемыми человеком спецификациями и машинно-верифицируемыми гарантиями корректности.*

### Свойство 1: Валидация changeset регистрации

*Для любого* набора данных, где хотя бы одно из условий выполнено: email имеет неверный формат, пароль короче 8 символов, поле `email`/`name`/`password` отсутствует — changeset регистрации должен быть невалидным и содержать ошибку на соответствующем поле.

**Validates: Requirements 1.2, 1.6**

### Свойство 2: Bcrypt salt — уникальность хэшей

*Для любого* пароля, два последовательных вызова `hash_password/1` должны возвращать разные строки (bcrypt использует случайную соль при каждом вызове).

**Validates: Requirements 1.8**

### Свойство 3: Регистрация Creator-а создаёт пользователя с ролью creator

*Для любого* валидного набора данных (корректный email, пароль >= 8 символов, непустое имя), вызов `Accounts.register_creator/1` должен возвращать `{:ok, user}`, где `user.role == "creator"`, и запись должна существовать в таблице `users`.

**Validates: Requirements 1.4, 2.1**

### Свойство 4: Уникальность email при регистрации Creator-а

*Для любого* email, уже существующего в таблице `users`, повторный вызов `Accounts.register_creator/1` с тем же email должен возвращать `{:error, changeset}` с ошибкой уникальности на поле `email`, и новая запись не должна создаваться.

**Validates: Requirements 1.5, 2.2**

### Свойство 5: Аутентификация Creator-а — round-trip

*Для любого* Creator-а, зарегистрированного через `Accounts.register_creator/1`, вызов `Accounts.authenticate/2` с теми же email и паролем должен возвращать `{:ok, user}`. Для любого неверного пароля или несуществующего email должен возвращаться `{:error, :invalid_credentials}`.

**Validates: Requirements 2.3, 2.4**

### Свойство 6: Создание токенов и сохранение refresh-токена в Redis

*Для любого* валидного пользователя (`User` или `EndUser`), вызов `Guardian.create_tokens/1` должен возвращать `{:ok, access_token, refresh_token}`, и после этого Redis должен содержать запись по ключу `{user_id}:refresh:{token_hash}` с TTL не более 30 дней.

**Validates: Requirements 3.2, 3.3**

### Свойство 7: Ротация refresh-токенов

*Для любого* валидного refresh-токена, вызов `Guardian.refresh_tokens/1` должен: (1) вернуть новую пару `{:ok, new_access_token, new_refresh_token}`, (2) инвалидировать старый refresh-токен в Redis так, что повторный вызов `Guardian.refresh_tokens/1` со старым токеном возвращает `{:error, :invalid_token}`.

**Validates: Requirements 3.4, 3.8**

### Свойство 8: Идемпотентность отзыва refresh-токена

*Для любого* refresh-токена (валидного или уже отозванного), двойной вызов `Guardian.revoke_refresh_token/1` должен возвращать `{:ok}` оба раза без ошибки.

**Validates: Requirements 3.6, 3.7**

### Свойство 9: Невалидный refresh-токен отклоняется

*Для любого* токена, отсутствующего в Redis (отозванного, истёкшего или никогда не существовавшего), вызов `Guardian.refresh_tokens/1` должен возвращать `{:error, :invalid_token}`.

**Validates: Requirements 3.5**

### Свойство 10: AuthRequired Plug — валидный токен устанавливает current_user

*Для любого* HTTP-запроса с валидным `Authorization: Bearer <token>` header, Plug `AuthRequired` должен декодировать токен, загрузить пользователя и установить `conn.assigns.current_user` в соответствующую структуру `User` или `EndUser`.

**Validates: Requirements 5.1**

### Свойство 11: AuthRequired Plug — невалидный или отсутствующий токен → HTTP 401

*Для любого* HTTP-запроса без `Authorization` header, с истёкшим токеном или с токеном, не прошедшим верификацию, Plug `AuthRequired` должен останавливать pipeline и возвращать HTTP 401.

**Validates: Requirements 5.2, 5.3**

### Свойство 12: RequireRole Plug — роль определяет доступ

*Для любого* пользователя и любой требуемой роли: если роль пользователя совпадает с требуемой — запрос пропускается дальше; если не совпадает — pipeline останавливается с HTTP 403.

**Validates: Requirements 5.4, 5.5**

### Свойство 13: TenantResolver — резолвинг поддомена

*Для любого* HTTP-запроса с Host header вида `<subdomain>.chatforge.app`, где `subdomain` соответствует существующему `ChatInstance`, Plug `TenantResolver` должен устанавливать `conn.assigns.tenant_id` и `conn.assigns.chat_instance` с корректными значениями.

**Validates: Requirements 6.1, 6.2**

### Свойство 14: TenantResolver — кеширование в Redis

*Для любого* поддомена, после первого успешного резолвинга, Redis должен содержать запись по ключу `tenant:<subdomain>` с TTL не более 5 минут. Повторный запрос с тем же поддоменом должен использовать кешированное значение.

**Validates: Requirements 6.3, 6.4**

### Свойство 15: TenantResolver — несуществующий поддомен → HTTP 404

*Для любого* поддомена, не соответствующего ни одному `ChatInstance` в БД, Plug `TenantResolver` должен останавливать pipeline и возвращать HTTP 404.

**Validates: Requirements 6.5**

### Свойство 16: Изоляция End User по тенанту

*Для любых* двух разных тенантов (`tenant_id_A` и `tenant_id_B`) и любого End User-а, зарегистрированного в `tenant_id_A`: вызов `Chat.authenticate_end_user/3` с `tenant_id_B` должен возвращать `{:error, :invalid_credentials}`, даже если email и пароль верны. Кроме того, попытка зарегистрировать End User-а с тем же email в рамках того же `tenant_id` должна возвращать `{:error, changeset}`.

**Validates: Requirements 7.4, 7.11**

### Свойство 17: Аутентификация End User — round-trip

*Для любого* End User-а, зарегистрированного через `Chat.register_end_user/2` с валидными данными, вызов `Chat.authenticate_end_user/3` с теми же `tenant_id`, email и паролем должен возвращать `{:ok, end_user}`. Для любых неверных credentials должен возвращаться `{:error, :invalid_credentials}`.

**Validates: Requirements 7.5, 7.6**

### Свойство 18: API_Client добавляет Authorization header

*Для любого* исходящего HTTP-запроса через `API_Client`, при наличии access-токена в памяти приложения, запрос должен содержать заголовок `Authorization: Bearer <access_token>`.

**Validates: Requirements 8.1**

### Свойство 19: API_Client автоматически обновляет токен при HTTP 401

*Для любого* запроса, получившего ответ HTTP 401, `API_Client` должен автоматически вызвать `POST /api/v1/auth/refresh` с refresh-токеном и повторить исходный запрос с новым access-токеном. Если refresh завершается ошибкой — состояние аутентификации очищается.

**Validates: Requirements 8.2, 8.3**

### Свойство 20: Защищённые маршруты перенаправляют неаутентифицированных пользователей

*Для любого* неаутентифицированного пользователя, обращающегося к защищённому маршруту (`/dashboard` и вложенные для Creator-а, `/chat` для End User-а), фронтенд должен перенаправлять на соответствующую страницу входа. Аутентифицированный пользователь, обращающийся к `/login` или `/register`, должен перенаправляться на защищённый маршрут.

**Validates: Requirements 9.7, 9.8, 10.5**

---

## Обработка ошибок

### Backend: стратегия ответов на ошибки

Все ошибки возвращаются в едином JSON-формате:

```json
// Ошибки валидации (HTTP 400 / 422)
{ "errors": { "field": ["message"] } }

// Ошибки аутентификации (HTTP 401)
{ "error": "invalid_credentials" }
{ "error": "invalid_token" }
{ "error": "token_expired" }

// Ошибки авторизации (HTTP 403)
{ "error": "forbidden" }

// Не найдено (HTTP 404)
{ "error": "not_found" }
```

### Обработка ошибок по компонентам

**Accounts.register_creator/1:**
- Невалидный changeset → `{:error, changeset}` → контроллер возвращает HTTP 422 с полями ошибок.
- Дублирующийся email → ошибка уникального ограничения в changeset → HTTP 422.

**Accounts.authenticate/2:**
- Несуществующий email → `{:error, :invalid_credentials}` → HTTP 401.
- Неверный пароль → `{:error, :invalid_credentials}` → HTTP 401.
- Важно: оба случая возвращают одинаковый ответ (защита от user enumeration).

**Guardian.refresh_tokens/1:**
- Токен отсутствует в Redis → `{:error, :invalid_token}` → HTTP 401.
- Токен истёк по TTL → Redis автоматически удаляет запись → `{:error, :invalid_token}` → HTTP 401.

**TenantResolver Plug:**
- Запрос без поддомена (например, `chatforge.app`) → Plug пропускается (не применяется к platform-маршрутам).
- Поддомен не найден в БД и не в кеше → HTTP 404.
- Ошибка Redis → fallback на запрос к БД (Redis недоступность не должна блокировать работу).

**AuthRequired Plug:**
- Отсутствует `Authorization` header → HTTP 401, `{"error": "unauthorized"}`.
- Невалидная подпись JWT → HTTP 401.
- Истёкший access-токен → HTTP 401 (фронтенд должен обновить токен через refresh).

### Frontend: обработка ошибок

**API_Client интерцептор:**
1. HTTP 401 → попытка refresh → повтор запроса.
2. Если refresh вернул ошибку → `creatorAuthStore.logout()` → `navigate('/login')`.
3. Другие ошибки (4xx, 5xx) → пробрасываются в вызывающий код.

**Формы (react-hook-form + zod):**
- Клиентская валидация срабатывает до отправки запроса.
- Серверные ошибки (422) отображаются рядом с соответствующими полями через `setError`.
- Общие ошибки (401, 500) отображаются через toast-уведомления (Sonner).

**ProtectedRoute:**
- Проверяет `isAuthenticated` из соответствующего стора.
- При `false` → `<Navigate to="/login" replace />`.
- При `true` и попытке зайти на `/login` → `<Navigate to="/dashboard" replace />`.

---

## Стратегия тестирования

### Подход

**Два уровня тестов:**
- **Unit/Integration тесты** — конкретные примеры: HTTP-статусы, структуры ответов, поведение при граничных случаях.
- **Property-based тесты** — универсальные свойства: корректность для любых валидных/невалидных входных данных.

Unit-тесты фокусируются на конкретных примерах и интеграционных точках. Property-тесты покрывают широкий диапазон входных данных через рандомизацию.

### Backend: Property-based тесты (StreamData)

Библиотека: [`stream_data`](https://hex.pm/packages/stream_data) — стандартная PBT-библиотека для Elixir.
Минимум 100 итераций на каждый property-тест.

```elixir
# Feature: chatforge-phase-2, Property 1: registration changeset validation
property "changeset невалиден для любых данных с коротким паролем" do
  check all password <- StreamData.string(:printable, max_length: 7),
            email    <- StreamData.string(:alphanumeric, min_length: 3),
            name     <- StreamData.string(:alphanumeric, min_length: 1),
            max_runs: 100 do
    changeset = User.registration_changeset(%User{}, %{
      email: email <> "@test.com",
      password: password,
      name: name
    })
    refute changeset.valid?
    assert Keyword.has_key?(changeset.errors, :password)
  end
end

# Feature: chatforge-phase-2, Property 2: bcrypt salt uniqueness
property "hash_password возвращает разные хэши для одного пароля" do
  check all password <- StreamData.string(:printable, min_length: 8),
            max_runs: 100 do
    hash1 = Accounts.hash_password(password)
    hash2 = Accounts.hash_password(password)
    assert hash1 != hash2
    assert Bcrypt.verify_pass(password, hash1)
    assert Bcrypt.verify_pass(password, hash2)
  end
end

# Feature: chatforge-phase-2, Property 5: authentication round-trip
property "register затем authenticate возвращает того же пользователя" do
  check all email    <- StreamData.string(:alphanumeric, min_length: 5),
            password <- StreamData.string(:printable, min_length: 8),
            name     <- StreamData.string(:alphanumeric, min_length: 1),
            max_runs: 100 do
    email = email <> "@test.com"
    {:ok, user} = Accounts.register_creator(%{email: email, password: password, name: name})
    assert {:ok, authenticated} = Accounts.authenticate(email, password)
    assert authenticated.id == user.id
    assert {:error, :invalid_credentials} = Accounts.authenticate(email, password <> "x")
  end
end

# Feature: chatforge-phase-2, Property 7: refresh token rotation
property "refresh_tokens инвалидирует старый токен" do
  check all user <- user_generator(), max_runs: 100 do
    {:ok, _access, refresh} = Guardian.create_tokens(user)
    {:ok, _new_access, _new_refresh} = Guardian.refresh_tokens(refresh)
    assert {:error, :invalid_token} = Guardian.refresh_tokens(refresh)
  end
end

# Feature: chatforge-phase-2, Property 8: revoke idempotency
property "двойной вызов revoke_refresh_token возвращает :ok" do
  check all user <- user_generator(), max_runs: 100 do
    {:ok, _access, refresh} = Guardian.create_tokens(user)
    assert {:ok} = Guardian.revoke_refresh_token(refresh)
    assert {:ok} = Guardian.revoke_refresh_token(refresh)
  end
end

# Feature: chatforge-phase-2, Property 16: end user tenant isolation
property "End User не может аутентифицироваться в чужом тенанте" do
  check all email    <- StreamData.string(:alphanumeric, min_length: 5),
            password <- StreamData.string(:printable, min_length: 8),
            name     <- StreamData.string(:alphanumeric, min_length: 1),
            max_runs: 100 do
    email = email <> "@test.com"
    {:ok, instance_a} = insert_chat_instance()
    {:ok, instance_b} = insert_chat_instance()
    {:ok, _end_user} = Chat.register_end_user(instance_a.id, %{
      email: email, password: password, name: name
    })
    assert {:error, :invalid_credentials} =
      Chat.authenticate_end_user(instance_b.id, email, password)
  end
end
```

### Backend: Unit/Integration тесты (ExUnit)

```elixir
# Accounts context
describe "Accounts" do
  test "register_creator/1 создаёт пользователя с ролью creator"
  test "register_creator/1 возвращает ошибку при дублирующемся email"
  test "authenticate/2 возвращает {:error, :invalid_credentials} для несуществующего email"
  test "get_user!/1 выбрасывает Ecto.NoResultsError для несуществующего id"
  test "get_user_by_email/1 возвращает nil для несуществующего email"
end

# AuthController
describe "POST /api/v1/auth/register" do
  test "возвращает 201 с user, access_token, refresh_token при валидных данных"
  test "возвращает 422 при дублирующемся email"
  test "возвращает 400 при невалидных полях"
end

describe "POST /api/v1/auth/login" do
  test "возвращает 200 с токенами при корректных credentials"
  test "возвращает 401 при неверных credentials"
end

describe "POST /api/v1/auth/refresh" do
  test "возвращает 200 с новой парой токенов"
  test "возвращает 401 при невалидном refresh-токене"
end

describe "GET /api/v1/auth/me" do
  test "возвращает 200 с данными пользователя при валидном Bearer"
  test "возвращает 401 без Authorization header"
end

# TenantResolver Plug
describe "TenantResolver" do
  test "устанавливает tenant_id для существующего поддомена"
  test "возвращает 404 для несуществующего поддомена"
  test "использует кеш Redis при повторном запросе"
end
```

### Frontend: тесты (Vitest + Testing Library)

```typescript
// Feature: chatforge-phase-2, Property 18: API_Client adds Authorization header
test('API_Client добавляет Authorization header при наличии токена', () => {
  // Устанавливаем токен в стор, проверяем что запрос содержит заголовок
})

// Feature: chatforge-phase-2, Property 20: protected routes redirect
test('ProtectedRoute перенаправляет неаутентифицированного пользователя на /login', () => {
  // Рендерим ProtectedRoute без токена, проверяем редирект
})

test('AuthRoute перенаправляет аутентифицированного пользователя на /dashboard', () => {
  // Рендерим /login с токеном, проверяем редирект
})

// Формы
test('форма регистрации показывает ошибки без отправки запроса при невалидных данных', () => {
  // Отправляем форму с пустыми полями, проверяем ошибки и отсутствие HTTP-запроса
})

// Изоляция сторов
test('EndUser_Auth_Store не влияет на Creator_Auth_Store', () => {
  // Логинимся как End User, проверяем что Creator стор не изменился
})
```

### Запуск тестов

```bash
# Backend (одиночный запуск)
mix test

# Frontend (одиночный запуск)
cd frontend && npx vitest --run
```
