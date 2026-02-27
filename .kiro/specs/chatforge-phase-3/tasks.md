# План реализации: ChatForge Phase 3 — Визард создания чата (Builder)

## Обзор

Последовательная реализация: Ecto-схемы и changesets → бизнес-логика контекста Instances + исправление TenantResolver → S3Adapter и загрузка аватаров → BuilderController (API визарда) → DashboardController (API управления) → Frontend (типы, API, Builder Store) → Frontend визард (шаги 1–4) → Frontend дашборд Creator-а. Каждый шаг строится на предыдущем и заканчивается интеграцией всех частей.

## Задачи

- [x] 1. Instances — Ecto-схемы и changesets
  - [x] 1.1 Реализовать схему `ChatForge.Instances.ChatInstance`
    - Создать `backend/lib/chatforge/instances/chat_instance.ex` со схемой `chat_instances` (поля: `id`, `creator_id`, `name`, `subdomain`, `currency`, `status`, `free_messages_limit`, `inserted_at`, `updated_at`)
    - Добавить `belongs_to :creator`, `has_one :instance_settings`
    - Реализовать `changeset/2`: валидация обязательных полей `creator_id`, `name`, `subdomain`, `currency`; формат поддомена `~r/^[a-z0-9-]+$/`; `validate_inclusion(:status, ["draft", "active", "suspended"])`; `validate_inclusion(:currency, ["RUB", "USD", "EUR"])`; `unique_constraint(:subdomain)`
    - _Требования: 1.1, 1.4, 1.7, 1.8, 1.9_

  - [ ]* 1.2 Написать property-тест для валидации формата поддомена в changeset
    - **Свойство 1: Инвариант формата поддомена в changeset**
    - **Validates: Requirements 1.4, 1.8**
    - Использовать `StreamData`, минимум 100 итераций
    - Для любой строки с символами вне `[a-z0-9-]` — changeset невалиден с ошибкой на `:subdomain`

  - [x] 1.3 Реализовать схему `ChatForge.Instances.InstanceSettings`
    - Создать `backend/lib/chatforge/instances/instance_settings.ex` со схемой `instance_settings` (поля: `id`, `chat_instance_id`, `primary_color`, `secondary_color`, `background_color`, `avatar_url`, `greeting_text`, `example_questions`, `system_prompt`, `inserted_at`, `updated_at`)
    - Добавить `belongs_to :chat_instance`
    - Реализовать `changeset/2`: валидация обязательного `chat_instance_id`; формат цветов `~r/^#[0-9A-Fa-f]{6}$/` для `primary_color`, `secondary_color`, `background_color`; `validate_length(:greeting_text, max: 1000)`
    - _Требования: 1.2, 1.5_

  - [ ]* 1.4 Написать property-тест для валидации формата цвета в changeset InstanceSettings
    - **Свойство 2: Инвариант формата цвета в changeset InstanceSettings**
    - **Validates: Requirements 1.5**
    - Для любой строки, не соответствующей `#RRGGBB`, — changeset невалиден с ошибкой на цветовом поле

  - [x] 1.5 Реализовать схему `ChatForge.Instances.WizardState`
    - Создать `backend/lib/chatforge/instances/wizard_state.ex` со схемой `wizard_states` (поля: `id`, `creator_id`, `current_step`, `draft_settings`, `inserted_at`, `updated_at`)
    - Добавить `belongs_to :creator`
    - Реализовать `changeset/2`: валидация обязательного `creator_id`; `validate_inclusion(:current_step, 1..4)`; `unique_constraint(:creator_id)`
    - _Требования: 1.3, 1.6_

  - [ ]* 1.6 Написать property-тест для валидации диапазона current_step в WizardState
    - **Свойство 3: Инвариант диапазона current_step в WizardState**
    - **Validates: Requirements 1.6**
    - Для любого целого числа вне `[1, 4]` — changeset невалиден с ошибкой на `:current_step`

  - [x] 1.7 Создать заглушку публичного API контекста `ChatForge.Instances`
    - Создать `backend/lib/chatforge/instances/instances.ex` с пустыми заглушками всех публичных функций (см. задачу 2)
    - _Требования: 2.1–2.15_

- [x] 2. Instances — бизнес-логика контекста + исправление TenantResolver
  - [x] 2.1 Реализовать функции управления ChatInstance в `ChatForge.Instances`
    - `create_instance/2` — создаёт `ChatInstance` со статусом `draft`, возвращает `{:ok, instance}` или `{:error, changeset}`
    - `get_instance_by_subdomain/1` — возвращает `{:ok, instance}` или `{:error, :not_found}`
    - `get_instance_by_creator/1` — возвращает `{:ok, instance}` с preload `instance_settings` или `{:error, :not_found}`
    - `validate_subdomain/1` — возвращает `{:ok, :available}`, `{:error, :taken}` или `{:error, :invalid_format}`
    - _Требования: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 2.11_

  - [ ]* 2.2 Написать property-тест: create_instance всегда создаёт со статусом draft
    - **Свойство 4: Создание инстанса — инвариант статуса draft**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.3 Написать property-тест: round-trip create + get_by_subdomain
    - **Свойство 5: Round-trip — создание и поиск инстанса по поддомену**
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 2.4 Написать property-тест: round-trip create + get_by_creator
    - **Свойство 6: Round-trip — создание инстанса и поиск по creator_id**
    - **Validates: Requirements 2.5, 2.6**

  - [ ]* 2.5 Написать property-тест: validate_subdomain комплексная валидация
    - **Свойство 7: Комплексная валидация поддомена**
    - **Validates: Requirements 2.9, 2.10, 2.11**

  - [x] 2.6 Реализовать функции управления InstanceSettings и WizardState
    - `update_settings/2` — обновляет `InstanceSettings`, возвращает `{:ok, settings}` или `{:error, changeset}`
    - `get_or_create_wizard_state/1` — получает или создаёт `WizardState` для `creator_id`, возвращает `{:ok, wizard_state}`
    - `update_wizard_step/3` — обновляет `current_step` и `draft_settings`, возвращает `{:ok, wizard_state}` или `{:error, changeset}`
    - _Требования: 2.7, 2.8_

  - [x] 2.7 Реализовать `finalize_wizard/1` через Ecto.Multi
    - `Ecto.Multi`: создать `ChatInstance` со статусом `active`, создать `InstanceSettings`, удалить `WizardState`
    - При неполном `WizardState` (отсутствуют обязательные поля) — вернуть `{:error, :incomplete_wizard}`
    - После успешного коммита — опубликовать событие `instance.created` через `Phoenix.PubSub`
    - _Требования: 2.12, 2.13, 2.14_

  - [ ]* 2.8 Написать property-тест: finalize_wizard инвариант
    - **Свойство 8: Инвариант финализации визарда**
    - **Validates: Requirements 2.12, 2.14**

  - [ ]* 2.9 Написать property-тест: PubSub-событие при финализации
    - **Свойство 9: PubSub-событие при финализации**
    - **Validates: Requirements 2.13**

  - [x] 2.10 Исправить `TenantResolver` — заменить прямой вызов Repo на Instances API
    - В `backend/lib/chatforge_web/plugs/tenant_resolver.ex` добавить `alias ChatForge.Instances`
    - Заменить `Repo.get_by(ChatInstance, subdomain: subdomain)` на `Instances.get_instance_by_subdomain(subdomain)`
    - _Требования: 2.15_

  - [ ]* 2.11 Написать property-тест: изоляция Creator-ов
    - **Свойство 13: Изоляция Creator-ов**
    - **Validates: Requirements 5.8**
    - `get_instance_by_creator(A.id)` никогда не возвращает инстанс с `creator_id == B.id`

- [x] 3. Checkpoint — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 4. S3Adapter — загрузка файлов
  - [x] 4.1 Реализовать `ChatForge.Instances.S3Adapter`
    - Создать `backend/lib/chatforge/instances/s3_adapter.ex`
    - Функция `upload/3` — загружает файл в S3/MinIO через `ex_aws`, возвращает `{:ok, url}` или `{:error, reason}`
    - Конфигурация через env-переменные в `config/runtime.exs`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_SCHEME`, `S3_HOST`, `S3_PORT`, `S3_BUCKET`, `S3_PUBLIC_URL`
    - _Требования: 3.1_

  - [x] 4.2 Реализовать `Instances.upload_avatar/2`
    - Добавить в `instances.ex` функцию `upload_avatar/2`
    - Валидация типа файла (`image/jpeg`, `image/png`, `image/webp`) ДО загрузки — `{:error, :invalid_file_type}` при несоответствии
    - Валидация размера (≤ 5 242 880 байт) ДО загрузки — `{:error, :file_too_large}` при превышении
    - При успешной загрузке — обновить `avatar_url` в `InstanceSettings`
    - _Требования: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.3 Написать property-тест: валидация файла аватара — тип и размер
    - **Свойство 10: Валидация файла аватара — тип и размер**
    - **Validates: Requirements 3.3, 3.4**
    - Для любого MIME-типа вне допустимых — `{:error, :invalid_file_type}` без обращения к S3
    - Для любого файла > 5 МБ — `{:error, :file_too_large}` без обращения к S3

- [x] 5. BuilderController — API визарда
  - [x] 5.1 Реализовать `ChatForgeWeb.BuilderController`
    - Создать `backend/lib/chatforge_web/controllers/builder_controller.ex`
    - `start/2` — `POST /api/v1/builder/start`: идемпотентный, вызывает `Instances.get_or_create_wizard_state/1`; при создании — HTTP 201, при существующем — HTTP 200
    - `state/2` — `GET /api/v1/builder/state`: возвращает HTTP 200 с `WizardState` или HTTP 404
    - `update_step/2` — `PUT /api/v1/builder/step/:step`: сохраняет данные шага через `Instances.update_wizard_step/3`; HTTP 200 или HTTP 422
    - `upload_avatar/2` — `POST /api/v1/builder/avatar`: загружает аватар через `Instances.upload_avatar/2`; HTTP 200 с `avatar_url` или HTTP 422
    - `finalize/2` — `POST /api/v1/builder/finalize`: вызывает `Instances.finalize_wizard/1`; HTTP 201 с данными `ChatInstance` или HTTP 422
    - `validate_subdomain/2` — `GET /api/v1/builder/validate-subdomain`: вызывает `Instances.validate_subdomain/1`; HTTP 200 или HTTP 422
    - _Требования: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14_

  - [x] 5.2 Обновить роутер — добавить scope `/api/v1/builder`
    - В `backend/lib/chatforge_web/router.ex` добавить scope с pipeline `[:api, :authenticated, :require_creator]`
    - Маршруты: `post "/start"`, `get "/state"`, `put "/step/:step"`, `post "/avatar"`, `post "/finalize"`, `get "/validate-subdomain"`
    - _Требования: 4.14_

  - [ ]* 5.3 Написать unit-тесты для BuilderController
    - `POST /api/v1/builder/start`: 201 при первом вызове, 200 при повторном (идемпотентность)
    - `GET /api/v1/builder/state`: 200 с данными, 404 без визарда
    - `PUT /api/v1/builder/step/1`: 200 при валидных цветах, 422 при невалидном формате
    - `POST /api/v1/builder/finalize`: 201 при полном WizardState, 422 при неполном
    - Все эндпоинты: 401 без токена
    - _Требования: 4.1–4.14_

  - [ ]* 5.4 Написать property-тест: идемпотентность старта визарда
    - **Свойство 11: Идемпотентность старта визарда**
    - **Validates: Requirements 4.2**
    - Повторный `POST /api/v1/builder/start` возвращает тот же `WizardState`, не создаёт дубликат в БД

- [x] 6. DashboardController — API управления инстансом
  - [x] 6.1 Реализовать `ChatForgeWeb.DashboardController`
    - Создать `backend/lib/chatforge_web/controllers/dashboard_controller.ex`
    - `show/2` — `GET /api/v1/dashboard/instance`: вызывает `Instances.get_instance_by_creator/1`; HTTP 200 с данными инстанса и settings или HTTP 404
    - `update_settings/2` — `PUT /api/v1/dashboard/instance/settings`: вызывает `Instances.update_settings/2`; HTTP 200 или HTTP 422
    - `upload_avatar/2` — `POST /api/v1/dashboard/instance/avatar`: вызывает `Instances.upload_avatar/2`; HTTP 200 с `avatar_url` или HTTP 422
    - Проверка `instance.creator_id == current_user.id` — при несовпадении HTTP 403
    - _Требования: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 6.2 Обновить роутер — добавить scope `/api/v1/dashboard`
    - В `backend/lib/chatforge_web/router.ex` добавить scope с pipeline `[:api, :authenticated, :require_creator]`
    - Маршруты: `get "/instance"`, `put "/instance/settings"`, `post "/instance/avatar"`
    - _Требования: 5.7_

  - [ ]* 6.3 Написать unit-тесты для DashboardController
    - `GET /api/v1/dashboard/instance`: 200 с данными, 404 без инстанса
    - `PUT /api/v1/dashboard/instance/settings`: 200 при валидных данных, 422 при невалидных
    - `POST /api/v1/dashboard/instance/avatar`: 200 с `avatar_url`, 422 при невалидном файле
    - Все эндпоинты: 401 без токена, 403 при попытке доступа к чужому инстансу
    - _Требования: 5.1–5.8_

- [x] 7. Checkpoint — убедиться, что все backend-тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 8. Frontend — типы, API-функции и Builder Store
  - [x] 8.1 Создать `frontend/src/features/builder/types.ts`
    - Типы `WizardState`, `ChatInstance`, `InstanceSettings`, `BuilderColors`, `Currency`
    - _Требования: 6.2_

  - [x] 8.2 Создать `frontend/src/features/builder/api.ts`
    - Типизированные функции: `startWizard`, `getWizardState`, `updateStep`, `uploadAvatar`, `finalize`, `validateSubdomain`
    - Использует `API_Client` из `shared/lib/api.ts`
    - _Требования: 6.1, 6.5, 6.9_

  - [x] 8.3 Создать `frontend/src/features/builder/store.ts` — Zustand Builder Store
    - Поля: `currentStep`, `colors`, `name`, `currency`, `avatarUrl`, `greetingText`, `exampleQuestions`, `freeMessagesLimit`
    - Методы: `setStep`, `setColors`, `setNameAndCurrency`, `setGreeting`, `setAvatar`, `setLimit`, `reset`
    - _Требования: 6.2, 6.3_

  - [ ]* 8.4 Написать property-тест: сохранение данных при навигации по шагам
    - **Свойство 12: Сохранение данных при навигации по шагам визарда**
    - **Validates: Requirements 6.3**
    - Для любой последовательности переходов данные шага N присутствуют при возврате на шаг N

- [x] 9. Frontend — визард (страница /builder)
  - [x] 9.1 Реализовать `frontend/src/features/builder/components/ProgressBar.tsx`
    - Отображает текущий шаг из 4
    - _Требования: 6.1_

  - [x] 9.2 Реализовать `frontend/src/features/builder/components/Step1Colors.tsx`
    - Палитра готовых цветовых схем + color picker для ручного выбора
    - Превью цветов обновляется в реальном времени при изменении
    - При переходе вперёд — вызывает `updateStep(1, colors)` через API
    - _Требования: 6.4_

  - [x] 9.3 Реализовать `frontend/src/features/builder/components/Step2Name.tsx`
    - Поле ввода названия чата (используется как поддомен), select для выбора валюты
    - Проверка доступности поддомена через `validateSubdomain` с debounce 500 мс
    - Отображение ошибок `:taken` ("Поддомен уже занят") и `:invalid_format` ("Только строчные буквы, цифры и дефис") рядом с полем
    - _Требования: 6.5, 6.6_

  - [x] 9.4 Реализовать `frontend/src/features/builder/components/Step3Greeting.tsx`
    - Зона drag & drop для загрузки аватара с превью
    - Textarea для текста приветствия
    - Интерфейс добавления и удаления примеров вопросов
    - _Требования: 6.7_

  - [x] 9.5 Реализовать `frontend/src/features/builder/components/Step4Limit.tsx`
    - Числовое поле для лимита бесплатных сообщений
    - Опция "без лимита" (значение `null`)
    - _Требования: 6.8_

  - [x] 9.6 Реализовать `frontend/src/features/builder/BuilderPage.tsx`
    - Контейнер визарда: рендерит `ProgressBar` и текущий шаг (Step1..Step4)
    - При нажатии "Завершить" на Шаге 4 — вызывает `finalize()`, при успехе отображает финальный экран "Ваш чат создан!" со ссылкой на публичный URL
    - При ошибке API — отображает сообщение об ошибке, не переходит к следующему шагу
    - _Требования: 6.9, 6.10_

  - [x] 9.7 Обновить `frontend/src/app/App.tsx` — добавить маршрут `/builder` и логику редиректов
    - Добавить маршрут `/builder` → `BuilderPage`
    - Creator без завершённого визарда при переходе на `/dashboard` → редирект на `/builder`
    - Creator с завершённым визардом при переходе на `/builder` → редирект на `/dashboard`
    - _Требования: 6.11_

- [x] 10. Frontend — дашборд Creator-а (страница /dashboard)
  - [x] 10.1 Создать `frontend/src/features/dashboard/api.ts`
    - Типизированные функции: `getInstance`, `updateSettings`, `uploadAvatar`
    - Использует `API_Client` из `shared/lib/api.ts`
    - _Требования: 7.2, 7.5_

  - [x] 10.2 Реализовать `frontend/src/features/dashboard/components/InstanceCard.tsx`
    - Отображает: название чата, поддомен, статус, публичный URL в формате `https://<subdomain>.chatforge.app` как кликабельную ссылку
    - _Требования: 7.2, 7.3_

  - [x] 10.3 Реализовать `frontend/src/features/dashboard/components/SettingsPanel.tsx`
    - Блок настроек с кнопками перехода к редактированию: цветовой схемы, аватара, текста приветствия
    - При сохранении — вызывает `updateSettings` или `uploadAvatar`
    - _Требования: 7.4, 7.5_

  - [x] 10.4 Реализовать `frontend/src/features/dashboard/DashboardPage.tsx`
    - Загружает данные инстанса через `getInstance` при монтировании
    - Рендерит `InstanceCard` и `SettingsPanel`
    - _Требования: 7.1, 7.2_

  - [x] 10.5 Обновить `frontend/src/app/App.tsx` — добавить маршрут `/dashboard` и логику редиректов
    - Добавить маршрут `/dashboard` → `DashboardPage` (только для аутентифицированных Creator-ов с инстансом)
    - Creator без инстанса при переходе на `/dashboard` → редирект на `/builder`
    - _Требования: 7.1, 7.6_

- [x] 11. Финальный checkpoint — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

## Примечания

- Задачи с `*` опциональны и могут быть пропущены для ускорения MVP
- Каждая задача ссылается на конкретные требования для трассируемости
- Property-тесты используют `stream_data`, минимум 100 итераций (`max_runs: 100`)
- Frontend-тесты используют Vitest + Testing Library
- Запуск backend-тестов: `mix test`; frontend-тестов: `cd frontend && npx vitest --run`
