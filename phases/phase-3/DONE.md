# Phase 3 — Что сделано

**Дата завершения:** 2026-02-26
**Статус:** ✅ Завершена

---

## Реализовано

### Backend — Ecto-схемы (ChatForge.Instances)
- `ChatForge.Instances.ChatInstance` — схема `chat_instances`, changeset с валидацией формата поддомена `~r/^[a-z0-9-]+$/`, статуса, валюты, unique constraint на subdomain
- `ChatForge.Instances.InstanceSettings` — схема `instance_settings`, changeset с валидацией формата цветов `~r/^#[0-9A-Fa-f]{6}$/`, длины greeting_text
- `ChatForge.Instances.WizardState` — схема `wizard_states`, changeset с валидацией `current_step` в диапазоне 1..4, unique constraint на creator_id

### Backend — Бизнес-логика (ChatForge.Instances)
- `create_instance/2` — создаёт ChatInstance со статусом `draft`
- `get_instance_by_subdomain/1` — поиск по поддомену, `{:ok, instance}` или `{:error, :not_found}`
- `get_instance_by_creator/1` — поиск по creator_id с preload instance_settings
- `validate_subdomain/1` — возвращает `:available`, `:taken` или `:invalid_format`
- `update_settings/2` — обновляет InstanceSettings
- `get_or_create_wizard_state/1` — идемпотентное получение/создание WizardState
- `update_wizard_step/3` — обновляет current_step и draft_settings
- `update_wizard_draft/2` — обновляет draft без изменения current_step
- `finalize_wizard/1` — Ecto.Multi: создаёт ChatInstance (active) + InstanceSettings, удаляет WizardState; публикует `instance.created` через PubSub
- `upload_avatar/2` — валидация типа/размера до загрузки, обновляет avatar_url в InstanceSettings

### Backend — S3Adapter
- `ChatForge.Instances.S3Adapter` — загрузка файлов в S3/MinIO через `ex_aws`
- Конфигурация через env-переменные: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_SCHEME`, `S3_HOST`, `S3_PORT`, `S3_BUCKET`, `S3_PUBLIC_URL`

### Backend — BuilderController (`/api/v1/builder/*`)
- `POST /start` — идемпотентный старт визарда (201 при создании, 200 при существующем)
- `GET /state` — текущий WizardState
- `PUT /step/:step` — сохранение данных шага
- `POST /avatar` — загрузка аватара
- `POST /finalize` — финализация визарда
- `GET /validate-subdomain` — проверка доступности поддомена
- Все маршруты защищены pipeline `[:api, :authenticated, :require_creator]`

### Backend — DashboardController (`/api/v1/dashboard/*`)
- `GET /instance` — данные инстанса + settings
- `PUT /instance/settings` — обновление настроек
- `POST /instance/avatar` — обновление аватара
- Проверка `instance.creator_id == current_user.id` → 403 при несовпадении

### Backend — TenantResolver (исправление)
- Заменён прямой вызов `Repo` на `Instances.get_instance_by_subdomain/1`

### Frontend — Builder (визард `/builder`)
- `features/builder/types.ts` — типы `WizardState`, `ChatInstance`, `InstanceSettings`, `BuilderColors`, `Currency`
- `features/builder/api.ts` — `startWizard`, `getWizardState`, `updateStep`, `uploadAvatar`, `finalize`, `validateSubdomain`
- `features/builder/store.ts` — Zustand store с полями и методами визарда
- `features/builder/components/ProgressBar.tsx` — прогресс-бар 1 из 4
- `features/builder/components/Step1Colors.tsx` — палитра + color picker + превью в реальном времени
- `features/builder/components/Step2Name.tsx` — название, валюта, debounce-проверка поддомена (500мс)
- `features/builder/components/Step3Greeting.tsx` — drag & drop аватар, приветствие, примеры вопросов
- `features/builder/components/Step4Limit.tsx` — лимит сообщений + "без лимита"
- `features/builder/BuilderPage.tsx` — контейнер с инициализацией, прогресс-баром, финальным экраном

### Frontend — Dashboard (дашборд `/dashboard`)
- `features/dashboard/api.ts` — `getInstance`, `updateSettings`, `uploadAvatar`
- `features/dashboard/components/InstanceCard.tsx` — карточка с названием, поддоменом, статусом, публичным URL
- `features/dashboard/components/SettingsPanel.tsx` — редактирование цветов, аватара, приветствия
- `features/dashboard/DashboardPage.tsx` — загрузка данных, редирект на `/builder` при отсутствии инстанса

### Frontend — Роутинг
- `app/App.tsx` — маршруты `/builder` и `/dashboard` с `CreatorProtectedRoute`
- Редирект: Creator без инстанса при `/dashboard` → `/builder` (через DashboardPage)

---

## Исправления после QA-проверки (2026-02-26)

- **Двойная финализация** — `Step4Limit` теперь передаёт `ChatInstance` через `onFinalize(instance)`, `BuilderPage` не вызывает `finalize()` повторно
- **`String.to_integer` без защиты** — заменён на `Integer.parse/1` с pattern matching `{n, ""} when n in 1..4`
- **Прямой `Repo` в контроллере** — добавлена функция `Instances.get_wizard_state/1`; `BuilderController.start/2` и `state/2` используют контекст вместо `Repo`
- **`current_step` не инкрементировался** — `update_wizard_step/3` теперь устанавливает `step + 1` (если шаг < 4)
- **`SettingsPanel` получал `undefined`** — `DashboardController.update_settings` теперь возвращает `{chat_instance: ...}` вместо `{settings: ...}`
- **Требование 6.11** — `BuilderPage` при инициализации проверяет наличие инстанса через `GET /api/v1/dashboard/instance`; при 200 → `<Navigate to="/dashboard" replace />`

## Известные ограничения

- Property-тесты (опциональные задачи 1.2, 1.4, 1.6, 2.2–2.11, 4.3, 5.3–5.4, 6.3, 8.4) не реализованы — отложены как MVP-ускорение
- Unit-тесты контроллеров (опциональные задачи 5.3, 6.3) не реализованы
- Инвалидация Redis-кеша тенанта при обновлении ChatInstance не реализована — кеш истекает через 5 минут автоматически

---

## Что НЕ входило в эту фазу

- Подписки и тарифные планы (Phase 5)
- Аналитика (Phase 6)
- AI-интеграция (Phase 4)
- Admin-панель (Phase 7)
