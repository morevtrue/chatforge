# Phase 7 — Tasks: Admin-панель платформы

## Backend

- [x] 1. Миграция: добавить колонку `status` в таблицу `users`
  - [x] 1.1 Создать миграцию `add_status_to_users` — `status VARCHAR(20) NOT NULL DEFAULT 'active'`
  - [x] 1.2 Добавить поле `status` в `User` schema и changeset (`cast`, `validate_inclusion`)
  - [x] 1.3 Обновить `Accounts.authenticate/2` — проверять `status == "active"`, иначе `{:error, :suspended}`

- [x] 2. Admin контекст — бизнес-логика (`backend/lib/chatforge/admin/admin.ex`)
  - [x] 2.1 `Admin.list_creators/1` — список Creator-ов с пагинацией (20/стр), поиском по email, фильтром по статусу
  - [x] 2.2 `Admin.get_creator_with_instances/1` — Creator + его инстансы
  - [x] 2.3 `Admin.list_instances/1` — список инстансов с пагинацией и фильтром по статусу
  - [x] 2.4 `Admin.get_platform_stats/0` — total_creators, active_instances, total_messages, total_revenue
  - [x] 2.5 `Admin.suspend_creator/2` — установить `status = "suspended"` + suspend все инстансы Creator-а; запрет на self-suspend
  - [x] 2.6 `Admin.activate_creator/2` — установить `status = "active"`
  - [x] 2.7 `Admin.suspend_instance/2` — установить `status = "suspended"` через `Instances.update_instance/2`
  - [x] 2.8 `Admin.activate_instance/2` — установить `status = "active"` через `Instances.update_instance/2`
  - [x] 2.9 `Admin.get_ai_usage/1` — агрегация по `ai_usage_logs` за период (7d/30d): total_tokens, total_cost, by_instance

- [x] 3. Plug `RequireSuperAdmin` (`backend/lib/chatforge_web/plugs/require_super_admin.ex`)
  - [x] 3.1 Проверить `conn.assigns.current_user.role == "super_admin"`, иначе HTTP 403

- [x] 4. Router — pipeline `:admin` и маршруты
  - [x] 4.1 Добавить pipeline `:admin` (AuthRequired + RequireSuperAdmin)
  - [x] 4.2 Добавить scope `/api/v1/admin` с 9 маршрутами (stats, creators CRUD, instances CRUD, ai-usage)

- [x] 5. AdminController (`backend/lib/chatforge_web/controllers/admin_controller.ex`)
  - [x] 5.1 `stats/2` — GET /api/v1/admin/stats
  - [x] 5.2 `list_creators/2` — GET /api/v1/admin/creators (params: page, search, status)
  - [x] 5.3 `get_creator/2` — GET /api/v1/admin/creators/:id
  - [x] 5.4 `suspend_creator/2` — PUT /api/v1/admin/creators/:id/suspend
  - [x] 5.5 `activate_creator/2` — PUT /api/v1/admin/creators/:id/activate
  - [x] 5.6 `list_instances/2` — GET /api/v1/admin/instances (params: page, status)
  - [x] 5.7 `suspend_instance/2` — PUT /api/v1/admin/instances/:id/suspend
  - [x] 5.8 `activate_instance/2` — PUT /api/v1/admin/instances/:id/activate
  - [x] 5.9 `ai_usage/2` — GET /api/v1/admin/ai-usage?period=7d|30d

## Frontend

- [x] 6. API-клиент (`frontend/src/features/admin/api.ts`)
  - [x] 6.1 Типы: `PlatformStats`, `CreatorRow`, `CreatorsPage`, `CreatorDetail`, `InstanceRow`, `InstancesPage`, `AiUsage`
  - [x] 6.2 Функции: `getStats`, `listCreators`, `getCreator`, `suspendCreator`, `activateCreator`, `listInstances`, `suspendInstance`, `activateInstance`, `getAiUsage`

- [x] 7. AdminRoute guard + AdminLayout (`frontend/src/pages/admin/`)
  - [x] 7.1 `AdminRoute` — проверяет `role === "super_admin"` из `useCreatorAuthStore`, иначе `<Navigate to="/dashboard" />`
  - [x] 7.2 `AdminLayout.tsx` — sidebar (Обзор / Creator-ы / Инстансы / AI Usage), шапка "Super Admin", кнопка выхода

- [x] 8. Страницы Admin-панели
  - [x] 8.1 `AdminOverviewPage.tsx` — 4 карточки статистики (Creator-ы, Инстансы, Сообщения, Доход)
  - [x] 8.2 `AdminCreatorsPage.tsx` — таблица Creator-ов, поиск по email (debounce 300ms), фильтр по статусу, пагинация, кнопки suspend/activate с confirm
  - [x] 8.3 `AdminInstancesPage.tsx` — таблица инстансов, фильтр по статусу, пагинация, кнопки suspend/activate с confirm
  - [x] 8.4 `AdminAiUsagePage.tsx` — переключатель периода, карточки токенов/стоимости, таблица по инстансам

- [x] 9. Роутинг (`frontend/src/app/App.tsx`)
  - [x] 9.1 Добавить `/admin` route с `AdminLayout` и вложенными страницами (index, creators, instances, ai-usage)
