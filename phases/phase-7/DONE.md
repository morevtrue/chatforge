# Phase 7 — DONE

## Что реализовано

### Backend

**Миграция:**
- `20250102000001_add_status_to_users.exs` — добавлена колонка `status VARCHAR(20) NOT NULL DEFAULT 'active'` в таблицу `users`

**Accounts контекст** — расширен:
- `User` schema — добавлено поле `status` (default: `"active"`) и `status_changeset/2`
- `Accounts.authenticate/2` — проверяет `status == "active"`, возвращает `{:error, :suspended}` для заблокированных
- `Accounts.update_user_status/2` — обновляет статус пользователя
- `Accounts.list_creators/1` — список Creator-ов с пагинацией (20/стр), поиском по email (ilike), фильтром по статусу

**Admin контекст** (`backend/lib/chatforge/admin/admin.ex`):
- `Admin.list_creators/1` — делегирует в `Accounts.list_creators/1`
- `Admin.get_creator_with_instances/1` — Creator + его инстансы
- `Admin.list_instances/1` — все инстансы с пагинацией, фильтром по статусу, preload creator
- `Admin.get_platform_stats/0` — total_creators, active_instances, total_messages, total_revenue
- `Admin.suspend_creator/2` — блокирует Creator-а + все его инстансы; запрет self-suspend
- `Admin.activate_creator/2` — разблокирует Creator-а
- `Admin.suspend_instance/2` — приостанавливает инстанс через `Instances.update_instance/2`
- `Admin.activate_instance/2` — восстанавливает инстанс через `Instances.update_instance/2`
- `Admin.get_ai_usage/1` — агрегация по `ai_usage_logs` за 7d/30d: total_tokens, total_cost, by_instance

**Plug** (`backend/lib/chatforge_web/plugs/require_super_admin.ex`):
- Проверяет `current_user.role == "super_admin"`, иначе HTTP 403

**Router** (`backend/lib/chatforge_web/router.ex`):
- Pipeline `:admin` (AuthRequired + RequireSuperAdmin)
- Scope `/api/v1/admin` с 9 маршрутами

**AdminController** (`backend/lib/chatforge_web/controllers/admin_controller.ex`):
- `stats/2` — GET /api/v1/admin/stats
- `list_creators/2` — GET /api/v1/admin/creators
- `get_creator/2` — GET /api/v1/admin/creators/:id
- `suspend_creator/2` — PUT /api/v1/admin/creators/:id/suspend
- `activate_creator/2` — PUT /api/v1/admin/creators/:id/activate
- `list_instances/2` — GET /api/v1/admin/instances
- `suspend_instance/2` — PUT /api/v1/admin/instances/:id/suspend
- `activate_instance/2` — PUT /api/v1/admin/instances/:id/activate
- `ai_usage/2` — GET /api/v1/admin/ai-usage?period=7d|30d

### Frontend

**Типы** (`frontend/src/features/auth/types.ts`):
- `User` — добавлено поле `status: string`

**API-клиент** (`frontend/src/features/admin/api.ts`):
- Типы: `PlatformStats`, `CreatorRow`, `CreatorsPage`, `CreatorDetail`, `InstanceRow`, `InstancesPage`, `AiUsage`, `AiUsageByInstance`
- Функции: `getStats`, `listCreators`, `getCreator`, `suspendCreator`, `activateCreator`, `listInstances`, `suspendInstance`, `activateInstance`, `getAiUsage`

**AdminLayout + AdminRoute** (`frontend/src/pages/admin/AdminLayout.tsx`):
- `AdminRoute` — guard: проверяет `role === "super_admin"`, иначе редирект на `/dashboard`
- `AdminLayout` — отдельный layout с sidebar (Обзор / Creator-ы / Инстансы / AI Usage), мобильный hamburger

**Страницы:**
- `AdminOverviewPage` — 4 карточки статистики, loading skeleton, error state с retry
- `AdminCreatorsPage` — таблица, поиск по email (debounce 300ms), фильтр по статусу, пагинация, suspend/activate с confirm
- `AdminInstancesPage` — таблица, фильтр по статусу, пагинация, suspend/activate с confirm
- `AdminAiUsagePage` — переключатель периода (7д/30д), 3 карточки, таблица по инстансам

**Роутинг** (`frontend/src/app/App.tsx`):
- `/admin` → `AdminLayout` (обёрнут в `AdminRoute`)
- `/admin` → `AdminOverviewPage`
- `/admin/creators` → `AdminCreatorsPage`
- `/admin/instances` → `AdminInstancesPage`
- `/admin/ai-usage` → `AdminAiUsagePage`

## Ограничения

- Создание Super Admin — только через seed/миграцию, не через UI
- `suspend_creator` не восстанавливает инстансы автоматически при `activate_creator` — инстансы нужно восстанавливать отдельно
- Валюта в AI Usage захардкожена как `$` — в будущем нужно брать из конфигурации провайдера

## Что не входило

- Создание Super Admin через UI
- Управление конфигурацией платформы через UI
- Просмотр содержимого диалогов пользователей
- Удаление Creator-ов и инстансов
