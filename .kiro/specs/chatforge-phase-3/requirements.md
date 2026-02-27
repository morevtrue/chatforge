# Требования — ChatForge Phase 3: Визард создания чата (Builder)

## Введение

Phase 3 реализует ключевую бизнес-функцию платформы ChatForge — пошаговый визард создания AI-чата (Builder Wizard). Creator проходит 4 шага: выбор цветовой схемы, задание названия и валюты, настройка приветствия и аватара, установка лимита бесплатных сообщений. После финализации создаётся `ChatInstance` со статусом `active`, доступный по уникальному поддомену.

Фаза включает: Ecto-схемы и бизнес-логику контекста `Instances`, загрузку файлов в S3/MinIO, REST API для визарда и управления инстансом, React-фронтенд визарда и базовый дашборд Creator-а.

Фаза не включает: подписки и тарифные планы (Phase 5), аналитику (Phase 6), AI-интеграцию (Phase 4).

Технический долг: `TenantResolver` из Phase 2 обращается к `Repo` напрямую — в рамках задачи 3.2 он должен быть исправлен для использования `Instances.get_instance_by_subdomain/1`.

---

## Глоссарий

- **System** — платформа ChatForge в целом.
- **Instances_Context** — Elixir bounded context `ChatForge.Instances`, отвечающий за Chat Instance-ы и визард.
- **ChatInstance** — Ecto-схема `ChatForge.Instances.ChatInstance`, отображающая таблицу `chat_instances`.
- **InstanceSettings** — Ecto-схема `ChatForge.Instances.InstanceSettings`, отображающая таблицу `instance_settings`.
- **WizardState** — Ecto-схема `ChatForge.Instances.WizardState`, хранящая прогресс визарда (текущий шаг, черновик настроек).
- **Creator** — пользователь платформы с ролью `creator`, создающий AI-чатботы.
- **Builder_API** — Phoenix-контроллер, обслуживающий эндпоинты `/api/v1/builder/*`.
- **Dashboard_API** — Phoenix-контроллер, обслуживающий эндпоинты `/api/v1/dashboard/*`.
- **TenantResolver** — Plug, определяющий текущий тенант по поддомену из Host header.
- **S3_Adapter** — модуль загрузки файлов, использующий `ex_aws` для работы с MinIO (dev) и S3 (prod).
- **Builder_Store** — Zustand-стор фронтенда (`src/features/builder/store.ts`), хранящий состояние визарда.
- **Frontend_Router** — React Router, маршрутизатор фронтенда.
- **PubSub** — Phoenix.PubSub, шина событий платформы.
- **AuthRequired** — Plug, проверяющий Bearer-токен и устанавливающий `current_user` в `conn.assigns`.

---

## Требования

### Требование 1: Instances — Ecto-схемы и changesets

**User Story:** Как разработчик, я хочу иметь Ecto-схемы и changesets для сущностей контекста Instances, чтобы безопасно создавать и валидировать данные Chat Instance-ов и прогресса визарда.

#### Критерии приёмки

1. THE Instances_Context SHALL содержать схему `ChatForge.Instances.ChatInstance`, отображающую таблицу `chat_instances` с полями: `id`, `creator_id`, `name`, `subdomain`, `currency`, `status`, `inserted_at`, `updated_at`.
2. THE Instances_Context SHALL содержать схему `ChatForge.Instances.InstanceSettings`, отображающую таблицу `instance_settings` с полями: `id`, `chat_instance_id`, `primary_color`, `secondary_color`, `background_color`, `avatar_url`, `greeting_text`, `example_questions`, `system_prompt`, `inserted_at`, `updated_at`.
3. THE Instances_Context SHALL содержать схему `ChatForge.Instances.WizardState` с полями: `id`, `creator_id`, `current_step`, `draft_settings` (JSONB), `inserted_at`, `updated_at`.
4. THE Instances_Context SHALL содержать changeset для `ChatInstance`, валидирующий: обязательность полей `creator_id`, `name`, `subdomain`, `currency`; формат поддомена (только символы `a-z`, `0-9`, дефис); уникальность `subdomain`; допустимые значения `status` (`draft`, `active`, `suspended`).
5. THE Instances_Context SHALL содержать changeset для `InstanceSettings`, валидирующий: обязательность `chat_instance_id`; формат цветов (hex-строка `#RRGGBB`); максимальную длину `greeting_text` 1000 символов.
6. THE Instances_Context SHALL содержать changeset для `WizardState`, валидирующий: обязательность `creator_id`; допустимый диапазон `current_step` от 1 до 4.
7. WHEN changeset `ChatInstance` вызывается с корректными данными, THE Instances_Context SHALL вернуть валидный changeset без ошибок.
8. IF поддомен содержит символы вне `[a-z0-9-]`, THEN THE Instances_Context SHALL вернуть changeset с ошибкой валидации на поле `subdomain`.
9. IF `subdomain` уже существует в таблице `chat_instances`, THEN THE Instances_Context SHALL вернуть changeset с ошибкой уникальности на поле `subdomain`.

---

### Требование 2: Instances — бизнес-логика

**User Story:** Как разработчик, я хочу иметь публичные функции контекста Instances для управления Chat Instance-ами, чтобы контроллеры и другие контексты могли вызывать их без знания деталей реализации.

#### Критерии приёмки

1. WHEN `Instances.create_instance/2` вызывается с валидными данными и существующим `creator_id`, THE Instances_Context SHALL создать `ChatInstance` со статусом `draft` и вернуть `{:ok, chat_instance}`.
2. IF `Instances.create_instance/2` вызывается с невалидными данными, THEN THE Instances_Context SHALL вернуть `{:error, changeset}` без создания записи в БД.
3. WHEN `Instances.get_instance_by_subdomain/1` вызывается с существующим поддоменом, THE Instances_Context SHALL вернуть `{:ok, chat_instance}`.
4. IF `Instances.get_instance_by_subdomain/1` вызывается с несуществующим поддоменом, THEN THE Instances_Context SHALL вернуть `{:error, :not_found}`.
5. WHEN `Instances.get_instance_by_creator/1` вызывается с существующим `creator_id`, THE Instances_Context SHALL вернуть `{:ok, chat_instance}` с предзагруженными `instance_settings`.
6. IF `Instances.get_instance_by_creator/1` вызывается с `creator_id`, у которого нет инстанса, THEN THE Instances_Context SHALL вернуть `{:error, :not_found}`.
7. WHEN `Instances.update_settings/2` вызывается с валидными данными, THE Instances_Context SHALL обновить `InstanceSettings` и вернуть `{:ok, instance_settings}`.
8. IF `Instances.update_settings/2` вызывается с невалидными данными, THEN THE Instances_Context SHALL вернуть `{:error, changeset}`.
9. WHEN `Instances.validate_subdomain/1` вызывается с поддоменом, содержащим только символы `[a-z0-9-]` и не занятым, THE Instances_Context SHALL вернуть `{:ok, :available}`.
10. IF `Instances.validate_subdomain/1` вызывается с уже занятым поддоменом, THEN THE Instances_Context SHALL вернуть `{:error, :taken}`.
11. IF `Instances.validate_subdomain/1` вызывается с поддоменом, содержащим недопустимые символы, THEN THE Instances_Context SHALL вернуть `{:error, :invalid_format}`.
12. WHEN `Instances.finalize_wizard/1` вызывается с `creator_id`, чей `WizardState` содержит все обязательные данные, THE Instances_Context SHALL создать `ChatInstance` со статусом `active`, удалить `WizardState` и вернуть `{:ok, chat_instance}`.
13. WHEN `Instances.finalize_wizard/1` успешно завершается, THE Instances_Context SHALL опубликовать событие `instance.created` через PubSub с данными созданного инстанса.
14. IF `Instances.finalize_wizard/1` вызывается с неполным `WizardState` (отсутствуют обязательные поля), THEN THE Instances_Context SHALL вернуть `{:error, :incomplete_wizard}`.
15. WHEN `TenantResolver` Plug вызывает поиск по поддомену, THE TenantResolver SHALL использовать `Instances.get_instance_by_subdomain/1` вместо прямого обращения к `Repo`.

---

### Требование 3: Instances — загрузка файлов (аватар)

**User Story:** Как Creator, я хочу загружать аватар для своего AI-чата, чтобы персонализировать внешний вид чат-бота.

#### Критерии приёмки

1. THE S3_Adapter SHALL быть настроен через переменные окружения: в dev-окружении использовать MinIO, в prod-окружении использовать AWS S3.
2. WHEN `Instances.upload_avatar/2` вызывается с валидным файлом изображения и `chat_instance_id`, THE Instances_Context SHALL загрузить файл в S3 и вернуть `{:ok, url}`, где `url` — публично доступный URL загруженного файла.
3. IF `Instances.upload_avatar/2` вызывается с файлом, тип которого не является `image/jpeg`, `image/png` или `image/webp`, THEN THE Instances_Context SHALL вернуть `{:error, :invalid_file_type}` без загрузки файла.
4. IF `Instances.upload_avatar/2` вызывается с файлом размером более 5 МБ, THEN THE Instances_Context SHALL вернуть `{:error, :file_too_large}` без загрузки файла.
5. WHEN аватар успешно загружен, THE Instances_Context SHALL обновить поле `avatar_url` в `InstanceSettings` соответствующего инстанса.

---

### Требование 4: Builder API — визард создания

**User Story:** Как Creator, я хочу иметь REST API для пошагового создания AI-чата, чтобы фронтенд мог сохранять прогресс каждого шага визарда.

#### Критерии приёмки

1. WHEN `POST /api/v1/builder/start` получает запрос от аутентифицированного Creator-а, THE Builder_API SHALL создать `WizardState` с `current_step: 1` и вернуть HTTP 201 с данными `WizardState`.
2. IF `POST /api/v1/builder/start` вызывается Creator-ом, у которого уже есть активный `WizardState`, THEN THE Builder_API SHALL вернуть HTTP 200 с существующим `WizardState` (идемпотентность).
3. WHEN `PUT /api/v1/builder/step/1` получает валидные данные (`primary_color`, `secondary_color`, `background_color`), THE Builder_API SHALL сохранить цвета в `WizardState.draft_settings`, обновить `current_step: 2` и вернуть HTTP 200.
4. IF `PUT /api/v1/builder/step/1` получает цвет в невалидном формате, THEN THE Builder_API SHALL вернуть HTTP 422 с описанием ошибки валидации.
5. WHEN `PUT /api/v1/builder/step/2` получает валидные данные (`name`, `currency`), THE Builder_API SHALL проверить доступность поддомена, сохранить данные в `WizardState.draft_settings`, обновить `current_step: 3` и вернуть HTTP 200.
6. IF `PUT /api/v1/builder/step/2` получает занятый или невалидный поддомен, THEN THE Builder_API SHALL вернуть HTTP 422 с описанием причины.
7. WHEN `PUT /api/v1/builder/step/3` получает валидные данные (`greeting_text`, `example_questions`), THE Builder_API SHALL сохранить данные в `WizardState.draft_settings`, обновить `current_step: 4` и вернуть HTTP 200.
8. WHEN `POST /api/v1/builder/avatar` получает валидный файл изображения, THE Builder_API SHALL загрузить аватар через `Instances.upload_avatar/2` и вернуть HTTP 200 с `avatar_url`.
9. IF `POST /api/v1/builder/avatar` получает файл невалидного типа или размера, THEN THE Builder_API SHALL вернуть HTTP 422 с описанием ошибки.
10. WHEN `PUT /api/v1/builder/step/4` получает валидные данные (`free_messages_limit`), THE Builder_API SHALL сохранить данные в `WizardState.draft_settings` и вернуть HTTP 200.
11. WHEN `POST /api/v1/builder/finalize` получает запрос с полным `WizardState`, THE Builder_API SHALL вызвать `Instances.finalize_wizard/1` и вернуть HTTP 201 с данными созданного `ChatInstance`.
12. IF `POST /api/v1/builder/finalize` вызывается с неполным `WizardState`, THEN THE Builder_API SHALL вернуть HTTP 422 с указанием недостающих данных.
13. WHEN `GET /api/v1/builder/state` получает запрос от аутентифицированного Creator-а, THE Builder_API SHALL вернуть HTTP 200 с текущим `WizardState` или HTTP 404, если визард не начат.
14. THE Builder_API SHALL требовать аутентификации Creator-а для всех эндпоинтов: запросы без валидного Bearer-токена SHALL получать HTTP 401.

---

### Требование 5: Dashboard API — управление инстансом

**User Story:** Как Creator, я хочу иметь REST API для управления настройками своего AI-чата после его создания, чтобы обновлять внешний вид и поведение чата.

#### Критерии приёмки

1. WHEN `GET /api/v1/dashboard/instance` получает запрос от аутентифицированного Creator-а, THE Dashboard_API SHALL вернуть HTTP 200 с данными `ChatInstance` и предзагруженными `InstanceSettings`.
2. IF `GET /api/v1/dashboard/instance` вызывается Creator-ом без созданного инстанса, THEN THE Dashboard_API SHALL вернуть HTTP 404.
3. WHEN `PUT /api/v1/dashboard/instance/settings` получает валидные данные настроек, THE Dashboard_API SHALL обновить `InstanceSettings` через `Instances.update_settings/2` и вернуть HTTP 200 с обновлёнными данными.
4. IF `PUT /api/v1/dashboard/instance/settings` получает невалидные данные, THEN THE Dashboard_API SHALL вернуть HTTP 422 с описанием ошибок валидации.
5. WHEN `POST /api/v1/dashboard/instance/avatar` получает валидный файл изображения, THE Dashboard_API SHALL загрузить аватар и вернуть HTTP 200 с обновлённым `avatar_url`.
6. IF `POST /api/v1/dashboard/instance/avatar` получает файл невалидного типа или размера, THEN THE Dashboard_API SHALL вернуть HTTP 422 с описанием ошибки.
7. THE Dashboard_API SHALL требовать аутентификации Creator-а для всех эндпоинтов: запросы без валидного Bearer-токена SHALL получать HTTP 401.
8. THE Dashboard_API SHALL обеспечить, что Creator может управлять только своим инстансом: попытка доступа к чужому инстансу SHALL возвращать HTTP 403.

---

### Требование 6: Frontend — визард создания (Builder)

**User Story:** Как Creator, я хочу иметь удобный пошаговый интерфейс создания AI-чата с превью в реальном времени, чтобы настроить свой чат без технических знаний.

#### Критерии приёмки

1. THE Frontend_Router SHALL содержать страницу `/builder` — контейнер визарда с прогресс-баром, отображающим текущий шаг из 4.
2. THE Builder_Store SHALL хранить состояние визарда: `currentStep`, `colors`, `name`, `currency`, `avatarUrl`, `greetingText`, `exampleQuestions`, `freeMessagesLimit`.
3. WHEN Creator переходит на шаг назад, THE Builder_Store SHALL сохранить все ранее введённые данные без потери.
4. THE Frontend_Router SHALL содержать Шаг 1: палитру готовых цветовых схем и color picker для ручного выбора; превью цветов SHALL обновляться в реальном времени при изменении.
5. THE Frontend_Router SHALL содержать Шаг 2: поле ввода названия чата (используется как поддомен), select для выбора валюты; WHEN Creator вводит название, THE Frontend_Router SHALL проверять доступность поддомена через API с debounce 500 мс.
6. IF поддомен недоступен или содержит недопустимые символы, THEN THE Frontend_Router SHALL отобразить сообщение об ошибке рядом с полем ввода без блокировки формы.
7. THE Frontend_Router SHALL содержать Шаг 3: зону drag & drop для загрузки аватара с превью, textarea для текста приветствия, интерфейс добавления и удаления примеров вопросов.
8. THE Frontend_Router SHALL содержать Шаг 4: числовое поле для лимита бесплатных сообщений с опцией "без лимита" (значение `null`).
9. WHEN Creator нажимает "Завершить" на Шаге 4, THE Frontend_Router SHALL вызвать `POST /api/v1/builder/finalize` и при успехе отобразить финальный экран "Ваш чат создан!" со ссылкой на публичный URL чата.
10. IF запрос к API завершается ошибкой на любом шаге, THEN THE Frontend_Router SHALL отобразить сообщение об ошибке и не переходить к следующему шагу.
11. WHILE Creator не завершил визард, THE Frontend_Router SHALL перенаправлять запросы к `/dashboard` на `/builder`.

---

### Требование 7: Frontend — дашборд Creator-а (базовый)

**User Story:** Как Creator, я хочу видеть информацию о своём созданном чате и иметь быстрый доступ к редактированию настроек, чтобы управлять своим AI-чатом.

#### Критерии приёмки

1. THE Frontend_Router SHALL содержать страницу `/dashboard`, доступную только аутентифицированным Creator-ам с созданным инстансом.
2. WHEN Creator открывает `/dashboard`, THE Frontend_Router SHALL загрузить данные инстанса через `GET /api/v1/dashboard/instance` и отобразить: название чата, поддомен, статус, текущие настройки.
3. THE Frontend_Router SHALL отображать публичный URL чата в формате `https://<subdomain>.chatforge.app` как кликабельную ссылку.
4. THE Frontend_Router SHALL содержать блок настроек с кнопками перехода к редактированию: цветовой схемы, аватара, текста приветствия.
5. WHEN Creator нажимает кнопку редактирования настройки, THE Frontend_Router SHALL открыть соответствующую форму редактирования и при сохранении вызвать `PUT /api/v1/dashboard/instance/settings`.
6. WHILE Creator не создал инстанс (нет активного `ChatInstance`), THE Frontend_Router SHALL перенаправлять запросы к `/dashboard` на `/builder`.

---

## Свойства корректности (Correctness Properties)

Данный раздел описывает свойства для Property-Based Testing (PBT).

### CP-1: Валидация поддомена — инвариант формата

Для любой строки `s`, содержащей хотя бы один символ вне `[a-z0-9-]`, `Instances.validate_subdomain(s)` SHALL возвращать `{:error, :invalid_format}`.

Обратное: для любой строки `s`, содержащей только символы `[a-z0-9-]` и не занятой, `Instances.validate_subdomain(s)` SHALL возвращать `{:ok, :available}`.

### CP-2: Round-trip — создание и поиск инстанса по поддомену

Для любого валидного поддомена `sub`: если `Instances.create_instance/2` вернул `{:ok, instance}` с `instance.subdomain == sub`, то `Instances.get_instance_by_subdomain(sub)` SHALL вернуть `{:ok, instance}` с теми же данными.

### CP-3: Идемпотентность — повторный старт визарда

Для любого `creator_id`: повторный вызов `POST /api/v1/builder/start` SHALL возвращать тот же `WizardState`, что и первый вызов (не создавать дубликат).

### CP-4: Инвариант статуса — финализация визарда

Для любого `creator_id`: после успешного вызова `Instances.finalize_wizard/1` статус созданного `ChatInstance` SHALL быть `active`, а `WizardState` для этого `creator_id` SHALL отсутствовать в БД.

### CP-5: Валидация файла — инвариант размера

Для любого файла размером `size > 5_242_880` байт (5 МБ): `Instances.upload_avatar/2` SHALL возвращать `{:error, :file_too_large}` независимо от типа файла.

### CP-6: Инвариант навигации визарда — сохранение данных

Для любой последовательности переходов между шагами визарда (вперёд и назад): данные, сохранённые на шаге N, SHALL присутствовать в `Builder_Store` при возврате на шаг N.

### CP-7: Изоляция Creator-ов

Для любых двух Creator-ов `A` и `B`: `Instances.get_instance_by_creator(A.id)` SHALL никогда не возвращать инстанс, принадлежащий `B`.
