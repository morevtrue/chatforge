# Design — Phase 6: Дашборд Creator-а и аналитика

## Обзор архитектуры

Фаза 6 реализует контекст `Analytics` на бэкенде и расширяет frontend-дашборд Creator-а. Следует принципам модульного монолита: Analytics слушает PubSub-события, не вызывает другие контексты напрямую (кроме Billing для подсчёта активных подписок через публичный API).

---

## Backend

### 6.1 Analytics контекст — схема и трекинг

**Файлы:**
- `backend/priv/repo/migrations/YYYYMMDD_create_analytics_events.exs`
- `backend/lib/chatforge/analytics/event.ex`
- `backend/lib/chatforge/analytics/analytics.ex`
- `backend/lib/chatforge/analytics/event_handler.ex`

**Схема `Event`:**
```elixir
schema "events" do
  field :chat_instance_id, :binary_id  # nullable
  field :event_type, :string
  field :payload, :map                  # JSONB
  timestamps(updated_at: false)
end
```

**`Analytics.track/3`:**
```elixir
def track(event_type, chat_instance_id, payload) do
  %Event{}
  |> Event.changeset(%{
    event_type: event_type,
    chat_instance_id: chat_instance_id,
    payload: payload
  })
  |> Repo.insert()
end
```

**`EventHandler` — GenServer, подписывается на PubSub при старте:**
```elixir
defmodule ChatForge.Analytics.EventHandler do
  use GenServer

  def start_link(_), do: GenServer.start_link(__MODULE__, [], name: __MODULE__)

  def init(_) do
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "accounts:users")
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "chat:messages")
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "billing:subscriptions")
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "instances:events")
    {:ok, []}
  end

  def handle_info({:user_registered, payload}, state) do
    Analytics.track("user_registered", payload[:tenant_id], payload)
    {:noreply, state}
  end
  # ... остальные события
end
```

EventHandler добавляется в supervision tree приложения.

---

### 6.2 Агрегация метрик

**Функции в `Analytics` модуле:**

```elixir
# Общее количество пользователей тенанта
def total_users(tenant_id) do
  EndUser |> where([u], u.chat_instance_id == ^tenant_id) |> Repo.aggregate(:count)
end

# Количество сообщений за период
def total_messages(tenant_id, period) do
  since = period_to_datetime(period)
  Event
  |> where([e], e.chat_instance_id == ^tenant_id and e.event_type == "message_sent")
  |> where([e], e.inserted_at >= ^since)
  |> Repo.aggregate(:count)
end

# Метрики по дням
def daily_stats(tenant_id, period) do
  since = period_to_datetime(period)
  # GROUP BY DATE(inserted_at) для каждого типа события
end

defp period_to_datetime(:day_7),  do: DateTime.add(DateTime.utc_now(), -7, :day)
defp period_to_datetime(:day_30), do: DateTime.add(DateTime.utc_now(), -30, :day)
defp period_to_datetime(:day_90), do: DateTime.add(DateTime.utc_now(), -90, :day)
```

Для `active_subscriptions/1` и `revenue/2` — вызов через `ChatForge.Billing` публичный API (не прямой доступ к схемам).

---

### 6.3 API контроллер аналитики

**Файл:** `backend/lib/chatforge_web/controllers/analytics_controller.ex`

**Роуты** (добавить в `router.ex` в scope `/api/v1/dashboard`):
```elixir
get "/analytics/overview", AnalyticsController, :overview
get "/analytics/messages",  AnalyticsController, :messages
get "/analytics/users",     AnalyticsController, :users
get "/analytics/revenue",   AnalyticsController, :revenue
```

**Контроллер:**
```elixir
defmodule ChatForgeWeb.AnalyticsController do
  use ChatForgeWeb, :controller

  def overview(conn, _params) do
    tenant_id = conn.assigns.current_user.chat_instance_id
    data = %{
      total_users:          Analytics.total_users(tenant_id),
      total_messages:       Analytics.total_messages(tenant_id, :day_30),
      active_subscriptions: Analytics.active_subscriptions(tenant_id),
      revenue:              Analytics.revenue(tenant_id, :day_30),
      conversion_rate:      Analytics.conversion_rate(tenant_id)
    }
    json(conn, %{data: data})
  end

  def messages(conn, %{"period" => period_str}) do
    with {:ok, period} <- parse_period(period_str),
         tenant_id     <- conn.assigns.current_user.chat_instance_id do
      stats = Analytics.daily_stats(tenant_id, period, "message_sent")
      json(conn, %{data: stats})
    else
      {:error, :invalid_period} ->
        conn |> put_status(422) |> json(%{error: "invalid period"})
    end
  end
  # аналогично users/2 и revenue/2
end
```

---

## Frontend

### 6.4 Дашборд Creator-а

**Структура файлов:**
```
frontend/src/pages/dashboard/
├── overview/
│   └── DashboardOverviewPage.tsx   # /dashboard
├── analytics/
│   └── DashboardAnalyticsPage.tsx  # /dashboard/analytics
├── settings/
│   └── DashboardSettingsPage.tsx   # /dashboard/settings
└── plans/
    └── DashboardPlansPage.tsx      # /dashboard/plans (существует)
```

**API-клиент** (`frontend/src/features/dashboard/analyticsApi.ts`):
```typescript
export const analyticsApi = {
  overview: () => api.get('/api/v1/dashboard/analytics/overview'),
  messages: (period: '7d' | '30d' | '90d') =>
    api.get(`/api/v1/dashboard/analytics/messages?period=${period}`),
  users:    (period: '7d' | '30d' | '90d') =>
    api.get(`/api/v1/dashboard/analytics/users?period=${period}`),
  revenue:  (period: '7d' | '30d' | '90d') =>
    api.get(`/api/v1/dashboard/analytics/revenue?period=${period}`),
}
```

**Компоненты:**
- `StatCard` — карточка с числом и лейблом, skeleton при загрузке
- `PeriodSelector` — кнопки 7д / 30д / 90д
- `MessageChart`, `UsersChart`, `RevenueChart` — `recharts` AreaChart
- `ConversionCard` — карточка с процентом конверсии

**Состояние:** TanStack Query для кеширования, `useState` для выбранного периода.

---

### 6.5 Редактор настроек

**Файл:** `frontend/src/pages/dashboard/settings/DashboardSettingsPage.tsx`

**Структура:**
```
┌─────────────────────────┬──────────────────┐
│  Форма настроек         │  Превью чата     │
│  - Внешний вид          │  (мини-виджет)   │
│  - Контент              │                  │
│  - AI                   │                  │
│  [Сохранить]            │                  │
└─────────────────────────┴──────────────────┘
```

Форма использует `react-hook-form` + `zod`. Превью обновляется через `watch()` без debounce (данные локальные, не отправляются на сервер).

Загрузка аватара — через существующий API `PUT /api/v1/dashboard/instance/avatar` (если реализован) или `multipart/form-data`.

---

### 6.6 Навигация дашборда

**Файл:** `frontend/src/pages/dashboard/DashboardLayout.tsx`

**Sidebar-пункты:**
```typescript
const navItems = [
  { label: 'Обзор',      path: '/dashboard',           icon: LayoutDashboard },
  { label: 'Аналитика',  path: '/dashboard/analytics', icon: BarChart2 },
  { label: 'Настройки',  path: '/dashboard/settings',  icon: Settings },
  { label: 'Тарифы',     path: '/dashboard/plans',     icon: CreditCard },
]
```

Мобильная адаптация: `useState(false)` для `isOpen`, overlay при открытом sidebar.

Хлебные крошки: компонент `Breadcrumbs` читает текущий `location.pathname` и маппит на лейблы.

---

## Миграция БД

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID REFERENCES chat_instances(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB DEFAULT '{}',
  inserted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX events_tenant_type_idx ON events (chat_instance_id, event_type);
CREATE INDEX events_inserted_at_idx ON events (inserted_at);
```

---

## Correctness Properties

### P1: Изоляция данных аналитики
Для любых двух тенантов `t1 ≠ t2`, метрики `total_users(t1)` не включают пользователей тенанта `t2`.

**Тест:** создать пользователей в двух тенантах, проверить что `total_users` каждого тенанта равно только своим пользователям.

### P2: Монотонность счётчика событий
После вызова `track/3` с `chat_instance_id = t`, значение `total_messages(t, :day_30)` не уменьшается.

**Тест:** property-based тест — генерировать N вызовов `track`, проверять что счётчик растёт монотонно.

### P3: Корректность конверсии
`conversion_rate(t) ∈ [0.0, 100.0]` для любого тенанта `t`.

**Тест:** property-based тест с граничными случаями: 0 пользователей, все платные, никто не платный.

### P4: Корректность периодов
`total_messages(t, :day_7) ≤ total_messages(t, :day_30) ≤ total_messages(t, :day_90)` для любого тенанта.

**Тест:** создать события в разные даты, проверить что более широкий период всегда ≥ узкому.

### P5: API изоляция
Creator с `tenant_id = t1` не может получить данные тенанта `t2` через API аналитики.

**Тест:** два Creator-а, запрос от первого — возвращает только данные первого тенанта.
