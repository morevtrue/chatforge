# Phase 7 — Design: Admin-панель платформы

## Backend

### 7.1 Admin контекст (`backend/lib/chatforge/admin/admin.ex`)

Реализует публичный API контекста. Использует только публичные функции других контекстов — не обращается к их Ecto-схемам напрямую.

```elixir
# Список Creator-ов с пагинацией и поиском
Admin.list_creators(%{page: 1, search: "email", status: "active"})
# → %{creators: [...], total: N, page: N, per_page: 20}

# Детали Creator-а + его инстансы
Admin.get_creator_with_instances(creator_id)
# → {:ok, %{creator: user, instances: [...]}} | {:error, :not_found}

# Список всех инстансов с фильтрами
Admin.list_instances(%{page: 1, status: "active"})
# → %{instances: [...], total: N, page: N, per_page: 20}

# Сводная статистика платформы
Admin.get_platform_stats()
# → %{total_creators: N, active_instances: N, total_messages: N, total_revenue: D}

# Блокировка Creator-а (+ suspend всех его инстансов)
Admin.suspend_creator(admin_user, creator_id)
# → {:ok, user} | {:error, :not_found} | {:error, :cannot_suspend_self}

# Разблокировка Creator-а
Admin.activate_creator(admin_user, creator_id)
# → {:ok, user} | {:error, :not_found}

# Приостановить инстанс
Admin.suspend_instance(admin_user, instance_id)
# → {:ok, instance} | {:error, :not_found}

# Восстановить инстанс
Admin.activate_instance(admin_user, instance_id)
# → {:ok, instance} | {:error, :not_found}

# Использование AI API за период
Admin.get_ai_usage(period)  # period: "7d" | "30d"
# → %{total_tokens: N, total_cost: D, by_instance: [...]}
```

Для `get_platform_stats/0` и `get_ai_usage/1` — запросы к таблицам `events`, `ai_usage_logs` через `Repo` напрямую (Admin контекст владеет правом агрегации по всей платформе).

Для `suspend_creator/2` — обновляет поле `status` в таблице `users` (через `Accounts` публичную функцию или прямой Repo-запрос, т.к. Admin контекст имеет право на это).

Для `suspend_instance/2` / `activate_instance/2` — вызывает `Instances.update_instance/2`.

### 7.2 Схема User — поле `status`

Добавить поле `status` в таблицу `users` (миграция):

```sql
ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
```

Changeset в `User` — добавить `status` в `cast` и `validate_inclusion`.

Обновить `Accounts.authenticate/2` — проверять `user.status == "active"`, иначе `{:error, :suspended}`.

### 7.3 Plug `RequireSuperAdmin`

```
backend/lib/chatforge_web/plugs/require_super_admin.ex
```

```elixir
def call(conn, _opts) do
  case conn.assigns[:current_user] do
    %{role: "super_admin"} -> conn
    _ -> forbidden(conn)
  end
end
```

### 7.4 Router — pipeline `:admin`

```elixir
pipeline :admin do
  plug ChatForgeWeb.Plugs.AuthRequired
  plug ChatForgeWeb.Plugs.RequireSuperAdmin
end

scope "/api/v1/admin", ChatForgeWeb do
  pipe_through [:api, :admin]

  get  "/stats",                    AdminController, :stats
  get  "/creators",                 AdminController, :list_creators
  get  "/creators/:id",             AdminController, :get_creator
  put  "/creators/:id/suspend",     AdminController, :suspend_creator
  put  "/creators/:id/activate",    AdminController, :activate_creator
  get  "/instances",                AdminController, :list_instances
  put  "/instances/:id/suspend",    AdminController, :suspend_instance
  put  "/instances/:id/activate",   AdminController, :activate_instance
  get  "/ai-usage",                 AdminController, :ai_usage
end
```

### 7.5 AdminController

```
backend/lib/chatforge_web/controllers/admin_controller.ex
```

Все actions принимают `conn` с `current_user` (super_admin). Делегируют в `Admin.*`. Возвращают JSON.

---

## Frontend

### Структура файлов

```
frontend/src/
├── pages/admin/
│   ├── AdminLayout.tsx              — layout с sidebar для admin
│   ├── overview/AdminOverviewPage.tsx
│   ├── creators/AdminCreatorsPage.tsx
│   ├── instances/AdminInstancesPage.tsx
│   └── ai-usage/AdminAiUsagePage.tsx
├── features/admin/
│   └── api.ts                       — API-функции для admin
```

### Роутинг (App.tsx)

```tsx
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminOverviewPage />} />
  <Route path="creators" element={<AdminCreatorsPage />} />
  <Route path="instances" element={<AdminInstancesPage />} />
  <Route path="ai-usage" element={<AdminAiUsagePage />} />
</Route>
```

`AdminRoute` — guard-компонент: проверяет `current_user.role === "super_admin"`, иначе `<Navigate to="/dashboard" />`.

Роль берётся из `useCreatorAuthStore` — в store уже хранится `user` объект с полем `role`.

### AdminLayout

Отдельный layout (не использует DashboardLayout). Sidebar с 4 пунктами:
- Обзор (`/admin`)
- Creator-ы (`/admin/creators`)
- Инстансы (`/admin/instances`)
- AI Usage (`/admin/ai-usage`)

Шапка с надписью "Super Admin" и кнопкой выхода.

### AdminOverviewPage

4 карточки: Creator-ы, Активные инстансы, Сообщения, Доход. Данные из `GET /api/v1/admin/stats`.

### AdminCreatorsPage

Таблица Creator-ов. Поиск по email (debounce 300ms). Фильтр по статусу. Пагинация.
Кнопки "Заблокировать" / "Разблокировать" с `window.confirm` перед действием.

### AdminInstancesPage

Таблица инстансов. Фильтр по статусу. Пагинация.
Кнопки "Приостановить" / "Восстановить" с `window.confirm`.

### AdminAiUsagePage

Переключатель периода (7д / 30д). Карточки суммарных токенов и стоимости. Таблица по инстансам.

### API (`features/admin/api.ts`)

```ts
getStats(): Promise<PlatformStats>
listCreators(params): Promise<CreatorsPage>
getCreator(id): Promise<CreatorDetail>
suspendCreator(id): Promise<void>
activateCreator(id): Promise<void>
listInstances(params): Promise<InstancesPage>
suspendInstance(id): Promise<void>
activateInstance(id): Promise<void>
getAiUsage(period): Promise<AiUsage>
```

---

## Миграция

```
backend/priv/repo/migrations/YYYYMMDDHHMMSS_add_status_to_users.exs
```

Добавляет колонку `status VARCHAR(20) NOT NULL DEFAULT 'active'` в таблицу `users`.

---

## Correctness Properties

**P1 — Только super_admin имеет доступ к Admin API**
Для любого запроса к `/api/v1/admin/*` с токеном пользователя с ролью `creator` — ответ всегда HTTP 403.

**P2 — Super Admin не может заблокировать себя**
`Admin.suspend_creator(admin, admin.id)` всегда возвращает `{:error, :cannot_suspend_self}`.

**P3 — Блокировка Creator-а блокирует его инстансы**
После `Admin.suspend_creator/2` все инстансы Creator-а имеют статус `suspended`.

**P4 — Заблокированный Creator не может войти**
`Accounts.authenticate/2` для пользователя со статусом `suspended` возвращает `{:error, :suspended}`.

**P5 — Пагинация корректна**
`list_creators(%{page: P})` возвращает не более 20 записей, `total` отражает реальное количество.
