# Дизайн — ChatForge Phase 5: Подписки и монетизация

## Обзор

Phase 5 реализует систему монетизации ChatForge. Creator создаёт тарифные планы через дашборд.
End User видит paywall при исчерпании бесплатного лимита и оформляет подписку через фейковый
платёжный адаптер. После оформления подписки `Chat.check_limit/2` учитывает лимит тарифного плана.

Фаза включает:
- Bounded context `ChatForge.Billing` — Ecto-схемы, бизнес-логика, Oban job, FakePayment.
- Расширение `ChatForge.Chat.check_limit/2` — учёт активной подписки.
- REST API для Creator-а (`/api/v1/dashboard/plans`) и End User-а (`/api/v1/chat/plans`, `/api/v1/chat/subscriptions`).
- Webhook-эндпоинт `POST /api/v1/webhooks/payment` — фейковая обработка оплаты.
- React-фронтенд: `features/billing/`, страница планов в дашборде, компонент Paywall, страницы success/cancel, статус подписки в ConversationPage.

Фаза не включает: реальную интеграцию со Stripe/ЮKassa, промокоды, возвраты через UI.

---

## Архитектура

### Общая схема Phase 5

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              КЛИЕНТЫ                                      │
│                                                                            │
│  Platform SPA (app.chatforge.app)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  DashboardPage → вкладка "Планы" → Dashboard_Plans_Page          │    │
│  │  billingStore (Zustand) + billing/api.ts                         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  Chat SPA (<subdomain>.chatforge.app)                                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  ConversationPage → <Paywall /> + статус подписки в сайдбаре     │    │
│  │  /chat/subscription/success  /chat/subscription/cancel           │    │
│  │  billingStore (Zustand) + billing/api.ts                         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTP
              ┌────────────────┴────────────────────┐
              │           PHOENIX APPLICATION        │
              │                                      │
              │  Router                              │
              │    /api/v1/dashboard/plans/*         │
              │      → PlanController (Creator)      │
              │    /api/v1/chat/plans                │
              │    /api/v1/chat/subscriptions/*      │
              │      → SubscriptionController        │
              │    /api/v1/webhooks/payment          │
              │      → WebhookController             │
              │                                      │
              │  ┌──────────────────────────────┐   │
              │  │  ChatForge.Billing           │   │
              │  │  (bounded context)           │   │
              │  │                              │   │
              │  │  SubscriptionPlan            │   │
              │  │  Subscription                │   │
              │  │  FakePayment                 │   │
              │  │  ExpireSubscriptionsJob      │   │
              │  │                              │   │
              │  │  create_plan/2               │   │
              │  │  list_plans/1                │   │
              │  │  update_plan/2               │   │
              │  │  deactivate_plan/1           │   │
              │  │  create_subscription/3       │   │
              │  │  get_active_subscription/2   │   │
              │  │  expire_subscriptions/0      │   │
              │  └──────────────┬───────────────┘   │
              │                 │ вызов через API    │
              │  ┌──────────────┴───────────────┐   │
              │  │  ChatForge.Chat (расширение) │   │
              │  │  check_limit/2 (обновлён)    │   │
              │  └──────────────────────────────┘   │
              │                                      │
              │  Phoenix.PubSub + Oban               │
              └────────────────┬────────────────────┘
                               │
                        ┌──────┴──────┐
                        │  PostgreSQL  │
                        │  sub_plans   │
                        │  subscriptions│
                        └─────────────┘
```

### Ключевые архитектурные решения

**1. Billing контекст не лезет в Chat напрямую**
`Chat.check_limit/2` вызывает `Billing.get_active_subscription/2` через публичный API контекста.
Billing не знает про Chat — только Chat знает про Billing. Это соблюдает архитектурные границы.

**2. FakePayment — адаптер с фиксированным интерфейсом**
`FakePayment.create_checkout_session/2` возвращает URL на страницу success с параметрами.
Страница success вызывает webhook, который создаёт подписку. Это имитирует реальный flow
(checkout → redirect → webhook) без реальной платёжной системы.

**3. Webhook без верификации подписи**
Фейковая реализация. В production здесь была бы верификация HMAC-подписи от Stripe/ЮKassa.
Структура кода намеренно оставляет место для этого (отдельный `WebhookController`).

**4. Oban job для истечения подписок**
`ExpireSubscriptionsJob` запускается по расписанию через Oban cron. Это надёжнее, чем
проверять `expires_at` при каждом запросе — подписки истекают даже если пользователь не активен.

**5. check_limit/2 — приоритет подписки над бесплатным лимитом**
Логика: сначала проверить активную подписку → если есть и `message_limit: nil` → allowed.
Если есть и числовой лимит → сравнить с `messages_used`. Если нет подписки → старая логика.

---

## Компоненты и интерфейсы

### Backend: ChatForge.Billing (публичный API)

```elixir
# --- Тарифные планы ---

# Создать тарифный план для инстанса
Billing.create_plan(attrs :: map(), tenant_id :: Ecto.UUID.t())
  → {:ok, %SubscriptionPlan{}} | {:error, %Ecto.Changeset{}}

# Список всех планов инстанса (сортировка: inserted_at ASC)
Billing.list_plans(tenant_id :: Ecto.UUID.t())
  → [%SubscriptionPlan{}]

# Обновить план
Billing.update_plan(plan_id :: Ecto.UUID.t(), attrs :: map())
  → {:ok, %SubscriptionPlan{}} | {:error, :not_found} | {:error, %Ecto.Changeset{}}

# Деактивировать план (is_active: false, не удалять)
Billing.deactivate_plan(plan_id :: Ecto.UUID.t())
  → {:ok, %SubscriptionPlan{}} | {:error, :not_found}

# --- Подписки ---

# Создать подписку после успешной оплаты
Billing.create_subscription(
  end_user_id :: Ecto.UUID.t(),
  plan_id     :: Ecto.UUID.t(),
  tenant_id   :: Ecto.UUID.t()
)
  → {:ok, %Subscription{}} | {:error, %Ecto.Changeset{}}

# Получить активную подписку пользователя (с предзагруженным планом)
Billing.get_active_subscription(
  end_user_id :: Ecto.UUID.t(),
  tenant_id   :: Ecto.UUID.t()
)
  → {:ok, %Subscription{plan: %SubscriptionPlan{}}} | {:ok, nil}

# Oban job: деактивировать истёкшие подписки
Billing.expire_subscriptions()
  → {:ok, count :: integer()}
```

### Backend: ChatForge.Billing.FakePayment

```elixir
defmodule ChatForge.Billing.FakePayment do
  # Создать фейковую checkout-сессию
  # Возвращает URL на страницу success с параметрами для webhook
  def create_checkout_session(plan_id :: Ecto.UUID.t(), end_user_id :: Ecto.UUID.t())
    → {:ok, url :: String.t()}
    # url = "/chat/subscription/success?plan_id=<plan_id>&user_id=<end_user_id>"
end
```

### Backend: ChatForge.Billing.ExpireSubscriptionsJob

```elixir
defmodule ChatForge.Billing.ExpireSubscriptionsJob do
  use Oban.Worker, queue: :billing

  # Запускается по расписанию Oban cron (ежедневно)
  # Обновляет status: "expired" для всех подписок где status == "active" AND expires_at < NOW()
  # Публикует событие subscription.expired через PubSub для каждой истёкшей подписки
  def perform(%Oban.Job{})
    → :ok
end
```

### Backend: Расширение ChatForge.Chat.check_limit/2

```elixir
# Обновлённая логика (файл: backend/lib/chatforge/chat/chat.ex)
def check_limit(end_user_id, tenant_id) do
  case Billing.get_active_subscription(end_user_id, tenant_id) do
    {:ok, %Subscription{plan: %{message_limit: nil}}} ->
      # Безлимитный план — всегда разрешено
      {:ok, :allowed}

    {:ok, %Subscription{plan: %{message_limit: limit}}} ->
      # Платный план с лимитом
      end_user = Repo.get!(EndUser, end_user_id)
      if end_user.messages_used < limit,
        do: {:ok, :allowed},
        else: {:error, :limit_reached}

    {:ok, nil} ->
      # Нет подписки — применить бесплатный лимит инстанса
      check_free_limit(end_user_id, tenant_id)
  end
end
```

### Backend: Контроллеры

```elixir
# PlanController — управление планами Creator-а
# GET /api/v1/dashboard/plans
def index(conn, _params)
  → JSON 200: %{plans: [...]}

# POST /api/v1/dashboard/plans
def create(conn, %{"plan" => plan_params})
  → JSON 201: %{plan: {...}} | JSON 422: %{errors: {...}}

# PUT /api/v1/dashboard/plans/:id
def update(conn, %{"id" => id, "plan" => plan_params})
  → JSON 200: %{plan: {...}} | JSON 404 | JSON 422

# DELETE /api/v1/dashboard/plans/:id
def delete(conn, %{"id" => id})
  → JSON 200: %{ok: true} | JSON 404

# SubscriptionController — планы и подписки End User-а
# GET /api/v1/chat/plans
def plans(conn, _params)
  → JSON 200: %{plans: [...]}

# POST /api/v1/chat/subscriptions
def create(conn, %{"plan_id" => plan_id})
  → JSON 200: %{checkout_url: url} | JSON 404

# GET /api/v1/chat/subscriptions/current
def current(conn, _params)
  → JSON 200: %{subscription: {...} | null}

# WebhookController — фейковый webhook
# POST /api/v1/webhooks/payment
def payment(conn, %{"plan_id" => plan_id, "user_id" => user_id})
  → JSON 200: %{ok: true} | JSON 422
```

### Backend: Дополнение роутера

```elixir
# Управление планами Creator-а (требует аутентификации Creator-а)
scope "/api/v1/dashboard", ChatForgeWeb do
  pipe_through [:api, :creator_authenticated]
  resources "/plans", PlanController, only: [:index, :create, :update, :delete]
end

# Публичный список планов (только TenantResolver)
scope "/api/v1/chat", ChatForgeWeb do
  pipe_through [:api, :chat_tenant]
  get "/plans", SubscriptionController, :plans
end

# Подписки End User-а (TenantResolver + EndUser auth)
scope "/api/v1/chat", ChatForgeWeb do
  pipe_through [:api, :chat_tenant, :authenticated]
  post "/subscriptions",         SubscriptionController, :create
  get  "/subscriptions/current", SubscriptionController, :current
end

# Фейковый webhook (без аутентификации)
scope "/api/v1/webhooks", ChatForgeWeb do
  pipe_through [:api]
  post "/payment", WebhookController, :payment
end
```

### Frontend: Структура файлов

```
frontend/src/
├── features/billing/
│   ├── api.ts              # Типизированные функции для billing-эндпоинтов
│   ├── billingStore.ts     # Zustand Billing Store
│   └── types.ts            # SubscriptionPlan, Subscription, CheckoutResponse
├── pages/
│   ├── dashboard/
│   │   └── plans/
│   │       └── DashboardPlansPage.tsx   # Управление планами Creator-а
│   └── chat/
│       └── subscription/
│           ├── SubscriptionSuccessPage.tsx
│           └── SubscriptionCancelPage.tsx
└── shared/ui/
    └── Paywall.tsx          # Модальный компонент Paywall
```

### Frontend: types.ts

```typescript
// src/features/billing/types.ts

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: "monthly" | "yearly";
  message_limit: number | null; // null = безлимит
  is_active: boolean;
}

export interface Subscription {
  id: string;
  status: "active" | "expired" | "cancelled";
  starts_at: string;
  expires_at: string;
  plan: SubscriptionPlan;
}

export interface CheckoutResponse {
  checkout_url: string;
}
```

### Frontend: api.ts

```typescript
// src/features/billing/api.ts

// Creator API
export const getPlans = (): Promise<{ plans: SubscriptionPlan[] }>
export const createPlan = (data: Partial<SubscriptionPlan>): Promise<{ plan: SubscriptionPlan }>
export const updatePlan = (id: string, data: Partial<SubscriptionPlan>): Promise<{ plan: SubscriptionPlan }>
export const deactivatePlan = (id: string): Promise<{ ok: boolean }>

// End User API
export const getPublicPlans = (): Promise<{ plans: SubscriptionPlan[] }>
export const startSubscription = (planId: string): Promise<CheckoutResponse>
export const getCurrentSubscription = (): Promise<{ subscription: Subscription | null }>

// Webhook
export const confirmPayment = (planId: string, userId: string): Promise<{ ok: boolean }>
```

### Frontend: billingStore.ts

```typescript
// src/features/billing/billingStore.ts
interface BillingState {
  // Creator
  plans: SubscriptionPlan[];
  plansLoading: boolean;

  // End User
  currentSubscription: Subscription | null;
  subscriptionLoading: boolean;
  publicPlans: SubscriptionPlan[];
  publicPlansLoading: boolean;

  // Paywall
  paywallOpen: boolean;

  // Методы
  fetchPlans: () => Promise<void>;
  fetchPublicPlans: () => Promise<void>;
  fetchCurrentSubscription: () => Promise<void>;
  openPaywall: () => void;
  closePaywall: () => void;
}
```

### Frontend: Компонент Paywall

```typescript
// src/shared/ui/Paywall.tsx
// Модальное окно, открывается при событии limit_reached из ChatChannel
// Загружает publicPlans из billingStore
// Для каждого плана: название, цена/период, лимит (или "Безлимит"), кнопка "Оформить"
// Клик "Оформить" → startSubscription(planId) → redirect на checkout_url
// Блокирует поле ввода в ConversationPage пока открыт
```

---

## Модели данных

### Ecto-схема: ChatForge.Billing.SubscriptionPlan

```elixir
schema "subscription_plans" do
  field :name,          :string
  field :price,         :decimal
  field :period,        :string   # "monthly" | "yearly"
  field :message_limit, :integer  # nil = безлимит
  field :is_active,     :boolean, default: true

  belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
             foreign_key: :chat_instance_id

  timestamps()
end

def changeset(plan, attrs) do
  plan
  |> cast(attrs, [:chat_instance_id, :name, :price, :period, :message_limit, :is_active])
  |> validate_required([:chat_instance_id, :name, :price, :period])
  |> validate_length(:name, max: 255)
  |> validate_inclusion(:period, ["monthly", "yearly"])
  |> validate_number(:price, greater_than: 0)
  |> foreign_key_constraint(:chat_instance_id)
end
```

### Ecto-схема: ChatForge.Billing.Subscription

```elixir
schema "subscriptions" do
  field :status,     :string   # "active" | "expired" | "cancelled"
  field :starts_at,  :utc_datetime
  field :expires_at, :utc_datetime

  belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
             foreign_key: :chat_instance_id
  belongs_to :end_user, ChatForge.Chat.EndUser
  belongs_to :plan,     ChatForge.Billing.SubscriptionPlan

  timestamps()
end

def changeset(subscription, attrs) do
  subscription
  |> cast(attrs, [:chat_instance_id, :end_user_id, :plan_id, :status, :starts_at, :expires_at])
  |> validate_required([:chat_instance_id, :end_user_id, :plan_id, :status, :starts_at, :expires_at])
  |> validate_inclusion(:status, ["active", "expired", "cancelled"])
  |> foreign_key_constraint(:chat_instance_id)
  |> foreign_key_constraint(:end_user_id)
  |> foreign_key_constraint(:plan_id)
end
```

### Миграции SQL

```sql
-- Миграция 1: subscription_plans
CREATE TABLE subscription_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  price            DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  period           VARCHAR(20) NOT NULL CHECK (period IN ('monthly', 'yearly')),
  message_limit    INTEGER,  -- NULL = безлимит
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  inserted_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_plans_chat_instance_id ON subscription_plans(chat_instance_id);
CREATE INDEX idx_subscription_plans_is_active        ON subscription_plans(is_active);

-- Миграция 2: subscriptions
CREATE TABLE subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id) ON DELETE CASCADE,
  end_user_id      UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  plan_id          UUID NOT NULL REFERENCES subscription_plans(id),
  status           VARCHAR(20) NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at        TIMESTAMP NOT NULL,
  expires_at       TIMESTAMP NOT NULL,
  inserted_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_end_user_id      ON subscriptions(end_user_id);
CREATE INDEX idx_subscriptions_chat_instance_id ON subscriptions(chat_instance_id);
CREATE INDEX idx_subscriptions_status           ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at       ON subscriptions(expires_at);
```

### API Response форматы

**GET /api/v1/dashboard/plans:**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Базовый",
      "price": "299.00",
      "period": "monthly",
      "message_limit": 500,
      "is_active": true,
      "inserted_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

**GET /api/v1/chat/plans:**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Базовый",
      "price": "299.00",
      "period": "monthly",
      "message_limit": 500
    }
  ]
}
```

**POST /api/v1/chat/subscriptions (200):**
```json
{
  "checkout_url": "/chat/subscription/success?plan_id=uuid&user_id=uuid"
}
```

**GET /api/v1/chat/subscriptions/current (200):**
```json
{
  "subscription": {
    "id": "uuid",
    "status": "active",
    "starts_at": "2025-01-15T10:00:00Z",
    "expires_at": "2025-02-14T10:00:00Z",
    "plan": {
      "id": "uuid",
      "name": "Базовый",
      "price": "299.00",
      "period": "monthly",
      "message_limit": 500
    }
  }
}
```

**GET /api/v1/chat/subscriptions/current (нет подписки):**
```json
{
  "subscription": null
}
```

---

## Свойства корректности

### Свойство 1: Инвариант tenant-изоляции планов

*Для любых* двух тенантов `A` и `B` (`A ≠ B`): `Billing.list_plans(A)` никогда не должен
содержать планы, где `chat_instance_id == B`. Аналогично, `Billing.update_plan/2` и
`Billing.deactivate_plan/1` должны возвращать `{:error, :not_found}` для планов чужого тенанта.

**Validates: Requirements 2.8, 5.5, 5.7**

### Свойство 2: Round-trip — создание и получение плана

*Для любых* валидных атрибутов и `tenant_id`: если `Billing.create_plan/2` вернул `{:ok, plan}`,
то `Billing.list_plans(tenant_id)` должен содержать план с тем же `id` и `chat_instance_id`.

**Validates: Requirements 2.1, 2.3**

### Свойство 3: Идемпотентность деактивации плана

*Для любого* `plan_id`: после первого вызова `Billing.deactivate_plan/1` план имеет `is_active: false`.
Повторный вызов `Billing.deactivate_plan/1` для того же `plan_id` должен возвращать `{:ok, plan}`
с `is_active: false` (не ошибку).

**Validates: Requirements 2.6**

### Свойство 4: Round-trip — создание и получение подписки

*Для любых* валидных `end_user_id`, `plan_id`, `tenant_id`: если `Billing.create_subscription/3`
вернул `{:ok, sub}`, то `Billing.get_active_subscription(end_user_id, tenant_id)` должен вернуть
`{:ok, subscription}` с тем же `id` и предзагруженным `plan`.

**Validates: Requirements 3.1, 3.3**

### Свойство 5: Инвариант истечения подписки

*Для любой* `Subscription` со статусом `active` и `expires_at < NOW()`: после вызова
`Billing.expire_subscriptions/0` статус этой подписки должен быть `expired`.
Подписки с `expires_at >= NOW()` должны оставаться `active`.

**Validates: Requirements 3.5**

### Свойство 6: Инвариант валидации цены плана

*Для любого* числового значения `price <= 0`: changeset `SubscriptionPlan` должен быть
невалидным с ошибкой на поле `price`. *Для любого* `price > 0`: changeset должен быть валидным
по полю `price`.

**Validates: Requirements 1.5, 2.2**

### Свойство 7: Инвариант безлимитного доступа

*Для любого* `end_user_id` с активной подпиской, где `plan.message_limit == nil`:
`Chat.check_limit/2` должен всегда возвращать `{:ok, :allowed}` независимо от значения
`EndUser.messages_used`.

**Validates: Requirements 7.2**

### Свойство 8: Инвариант приоритета подписки

*Для любого* `end_user_id` с активной подпиской с числовым `message_limit`:
`Chat.check_limit/2` должен использовать `plan.message_limit`, а не бесплатный лимит инстанса.
Если `messages_used < plan.message_limit` — результат `{:ok, :allowed}`, даже если
`messages_used > free_limit`.

**Validates: Requirements 7.3**

---

## Обработка ошибок

### Backend: стратегия ответов

Все ошибки возвращаются в едином JSON-формате (унаследован из предыдущих фаз):

```json
// Ошибки валидации (HTTP 422)
{ "errors": { "price": ["must be greater than 0"] } }

// Не найдено (HTTP 404)
{ "error": "not_found" }

// Не авторизован (HTTP 401)
{ "error": "unauthorized" }
```

### Обработка ошибок по компонентам

**Billing.create_plan/2:**
- Невалидные атрибуты → `{:error, changeset}` → HTTP 422.

**Billing.update_plan/2 / deactivate_plan/1:**
- План не найден или чужой тенант → `{:error, :not_found}` → HTTP 404.

**Billing.create_subscription/3:**
- Невалидные данные → `{:error, changeset}` → HTTP 422.
- Неактивный или чужой план → HTTP 404 (проверяется в контроллере до вызова).

**WebhookController:**
- Отсутствует `plan_id` или `user_id` → HTTP 422.
- `Billing.create_subscription/3` вернул ошибку → HTTP 422.

**ExpireSubscriptionsJob:**
- Ошибка БД → Oban повторит попытку согласно политике retry.
- Ошибка PubSub при публикации события → `Logger.error/1`, job не падает.

**Frontend:**
- Ошибки API → toast через Sonner с текстом ошибки.
- Ошибка загрузки планов в Paywall → сообщение об ошибке внутри модального окна.
- Ошибка webhook на SubscriptionSuccessPage → кнопка "Попробовать снова".
