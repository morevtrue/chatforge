# План реализации: ChatForge Phase 2 — Аутентификация

## Обзор

Последовательная реализация полного цикла аутентификации: Ecto-схемы и changesets → бизнес-логика контекстов → Guardian JWT + Redis → контроллеры и Plug-и → роутер → фронтенд (API-клиент, сторы, страницы, роутинг). Каждый шаг строится на предыдущем и заканчивается интеграцией всех частей.

## Задачи

- [x] 1. Accounts — Ecto-схема и changesets для Creator-а
  - [x] 1.1 Реализовать схему `ChatForge.Accounts.User` и changesets
    - Создать `lib/chatforge/accounts/user.ex` со схемой `users` (поля: `id`, `email`, `password_hash`, `name`, `phone`, `telegram`, `role`, `inserted_at`, `updated_at`)
    - Добавить виртуальное поле `password`
    - Реализовать `registration_changeset/2`: валидация формата email, уникальности email, длины пароля >= 8, обязательных полей `email`, `name`, `password`
    - Реализовать `login_changeset/2`: принимает только `email` и `password`
    - Реализовать приватную функцию `put_password_hash/1` через `bcrypt_elixir`
    - _Требования: 1.1, 1.2, 1.3, 1.7_

  - [ ]* 1.2 Написать property-тест для валидации changeset регистрации
    - **Свойство 1: Валидация changeset регистрации**
    - **Validates: Requirements 1.2, 1.6**
    - Использовать `StreamData`, минимум 100 итераций
    - Генерировать данные с коротким паролем (< 8 символов), невалидным email, отсутствующими обязательными полями

  - [ ]* 1.3 Написать property-тест для уникальности bcrypt-хэшей
    - **Свойство 2: Bcrypt salt — уникальность хэшей**
    - **Validates: Requirements 1.8**
    - Для любого пароля два вызова `hash_password/1` должны возвращать разные строки, оба верифицируемые через `Bcrypt.verify_pass/2`

- [x] 2. Accounts — бизнес-логика Creator-а
  - [x] 2.1 Реализовать публичный API контекста `ChatForge.Accounts`
    - Добавить в `lib/chatforge/accounts/accounts.ex` функции: `register_creator/1`, `authenticate/2`, `get_user!/1`, `get_user_by_email/1`, `hash_password/1`
    - `register_creator/1` создаёт пользователя с `role: "creator"` через `registration_changeset`
    - `authenticate/2` проверяет пароль через `Bcrypt.verify_pass/2`, возвращает `{:ok, user}` или `{:error, :invalid_credentials}`
    - _Требования: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 2.2 Написать property-тест: регистрация создаёт Creator-а с ролью creator
    - **Свойство 3: Регистрация Creator-а создаёт пользователя с ролью creator**
    - **Validates: Requirements 1.4, 2.1**
    - Для любых валидных данных `register_creator/1` возвращает `{:ok, user}` с `user.role == "creator"`

  - [ ]* 2.3 Написать property-тест: уникальность email при регистрации
    - **Свойство 4: Уникальность email при регистрации Creator-а**
    - **Validates: Requirements 1.5, 2.2**
    - Повторная регистрация с тем же email возвращает `{:error, changeset}` с ошибкой уникальности

  - [ ]* 2.4 Написать property-тест: round-trip аутентификации Creator-а
    - **Свойство 5: Аутентификация Creator-а — round-trip**
    - **Validates: Requirements 2.3, 2.4**
    - После `register_creator/1` вызов `authenticate/2` с теми же credentials возвращает `{:ok, user}`; с неверным паролем — `{:error, :invalid_credentials}`

- [x] 3. Guardian — JWT и Redis-интеграция
  - [x] 3.1 Настроить `ChatForge.Guardian` и реализовать управление токенами
    - Создать `lib/chatforge/guardian.ex` с `use Guardian, otp_app: :chatforge`
    - Настроить секрет из `GUARDIAN_SECRET_KEY` и TTL access-токена 15 минут в `config/runtime.exs`
    - Реализовать `create_tokens/1`: создаёт access JWT + refresh JWT, сохраняет refresh в Redis по ключу `{user_id}:refresh:{token_hash}` с TTL 30 дней
    - Реализовать `refresh_tokens/1`: проверяет наличие refresh в Redis, выдаёт новую пару, инвалидирует старый refresh (ротация)
    - Реализовать `revoke_refresh_token/1`: удаляет запись из Redis, идемпотентно
    - JWT claims для Creator: `sub`, `typ`, `role`, `iss`, `exp`; для End User добавить `tenant_id`
    - _Требования: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 3.2 Написать property-тест: создание токенов и сохранение в Redis
    - **Свойство 6: Создание токенов и сохранение refresh-токена в Redis**
    - **Validates: Requirements 3.2, 3.3**
    - Для любого валидного пользователя `create_tokens/1` возвращает `{:ok, access, refresh}` и Redis содержит запись с TTL <= 30 дней

  - [ ]* 3.3 Написать property-тест: ротация refresh-токенов
    - **Свойство 7: Ротация refresh-токенов**
    - **Validates: Requirements 3.4, 3.8**
    - После `refresh_tokens/1` старый refresh-токен отклоняется с `{:error, :invalid_token}`

  - [ ]* 3.4 Написать property-тест: идемпотентность отзыва токена
    - **Свойство 8: Идемпотентность отзыва refresh-токена**
    - **Validates: Requirements 3.6, 3.7**
    - Двойной вызов `revoke_refresh_token/1` возвращает `{:ok}` оба раза

  - [ ]* 3.5 Написать property-тест: невалидный refresh-токен отклоняется
    - **Свойство 9: Невалидный refresh-токен отклоняется**
    - **Validates: Requirements 3.5**
    - Токен, отсутствующий в Redis, возвращает `{:error, :invalid_token}`

- [ ] 4. Checkpoint — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 5. Auth Plug-и — AuthRequired и RequireRole
  - [x] 5.1 Реализовать `ChatForgeWeb.Plugs.AuthRequired`
    - Создать `lib/chatforge_web/plugs/auth_required.ex`
    - Извлекает Bearer-токен из `Authorization` header
    - Декодирует JWT через Guardian, загружает пользователя, устанавливает `conn.assigns.current_user`
    - При отсутствии header или невалидном/истёкшем токене: `halt` с HTTP 401 `{"error": "unauthorized"}`
    - _Требования: 5.1, 5.2, 5.3_

  - [ ]* 5.2 Написать property-тест: AuthRequired с валидным токеном устанавливает current_user
    - **Свойство 10: AuthRequired Plug — валидный токен устанавливает current_user**
    - **Validates: Requirements 5.1**

  - [ ]* 5.3 Написать property-тест: AuthRequired с невалидным токеном возвращает 401
    - **Свойство 11: AuthRequired Plug — невалидный или отсутствующий токен → HTTP 401**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 5.4 Реализовать `ChatForgeWeb.Plugs.RequireRole`
    - Создать `lib/chatforge_web/plugs/require_role.ex`
    - Проверяет `conn.assigns.current_user.role` против требуемой роли
    - При несовпадении: `halt` с HTTP 403 `{"error": "forbidden"}`
    - _Требования: 5.4, 5.5_

  - [ ]* 5.5 Написать property-тест: RequireRole определяет доступ по роли
    - **Свойство 12: RequireRole Plug — роль определяет доступ**
    - **Validates: Requirements 5.4, 5.5**

- [x] 6. TenantResolver Plug
  - [x] 6.1 Реализовать `ChatForgeWeb.Plugs.TenantResolver`
    - Создать `lib/chatforge_web/plugs/tenant_resolver.ex`
    - Извлекает поддомен из `Host` header (формат `<subdomain>.chatforge.app`)
    - Проверяет Redis по ключу `tenant:<subdomain>` (TTL 5 минут)
    - При cache miss: ищет `ChatInstance` в БД, кеширует результат в Redis
    - При успехе: устанавливает `conn.assigns.tenant_id` и `conn.assigns.chat_instance`
    - При отсутствии поддомена в БД: `halt` с HTTP 404
    - При недоступности Redis: fallback на запрос к БД
    - _Требования: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 6.2 Написать property-тест: TenantResolver резолвит поддомен
    - **Свойство 13: TenantResolver — резолвинг поддомена**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 6.3 Написать property-тест: TenantResolver кеширует в Redis
    - **Свойство 14: TenantResolver — кеширование в Redis**
    - **Validates: Requirements 6.3, 6.4**
    - После первого резолвинга Redis содержит запись с TTL <= 5 минут; повторный запрос использует кеш

  - [ ]* 6.4 Написать property-тест: несуществующий поддомен → HTTP 404
    - **Свойство 15: TenantResolver — несуществующий поддомен → HTTP 404**
    - **Validates: Requirements 6.5**

- [x] 7. AuthController — API Creator-а
  - [x] 7.1 Реализовать `ChatForgeWeb.AuthController`
    - Создать `lib/chatforge_web/controllers/auth_controller.ex`
    - `register/2`: вызывает `Accounts.register_creator/1` + `Guardian.create_tokens/1`, возвращает HTTP 201 с `{user, access_token, refresh_token}`; при ошибке changeset — HTTP 422; при невалидных полях — HTTP 400
    - `login/2`: вызывает `Accounts.authenticate/2` + `Guardian.create_tokens/1`, возвращает HTTP 200; при ошибке — HTTP 401
    - `logout/2`: вызывает `Guardian.revoke_refresh_token/1`, возвращает HTTP 200
    - `refresh/2`: вызывает `Guardian.refresh_tokens/1`, возвращает HTTP 200 с новой парой; при ошибке — HTTP 401
    - `me/2`: возвращает HTTP 200 с `conn.assigns.current_user`
    - _Требования: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ]* 7.2 Написать unit-тесты для AuthController
    - `POST /api/v1/auth/register`: 201 при валидных данных, 422 при дублирующемся email, 400 при невалидных полях
    - `POST /api/v1/auth/login`: 200 при корректных credentials, 401 при неверных
    - `POST /api/v1/auth/refresh`: 200 с новой парой, 401 при невалидном токене
    - `GET /api/v1/auth/me`: 200 с данными пользователя, 401 без Authorization header

- [x] 8. Chat — EndUser схема и бизнес-логика
  - [x] 8.1 Реализовать схему `ChatForge.Chat.EndUser` и changesets
    - Создать `lib/chatforge/chat/end_user.ex` со схемой `end_users` (поля: `id`, `chat_instance_id`, `email`, `password_hash`, `name`, `messages_used`, `inserted_at`, `updated_at`)
    - Добавить виртуальное поле `password`, `belongs_to :chat_instance`
    - Реализовать `registration_changeset/3`: валидация формата email, уникальности email в рамках `chat_instance_id` (constraint `:end_users_email_instance_index`), длины пароля >= 8, обязательных полей
    - _Требования: 7.1, 7.2_

  - [x] 8.2 Реализовать публичный API контекста `ChatForge.Chat` (End User часть)
    - Добавить в `lib/chatforge/chat/chat.ex` функции: `register_end_user/2`, `authenticate_end_user/3`
    - `register_end_user/2` принимает `tenant_id` и attrs, создаёт EndUser с привязкой к тенанту
    - `authenticate_end_user/3` проверяет `tenant_id`, email и пароль; возвращает `{:ok, end_user}` или `{:error, :invalid_credentials}`
    - End User одного тенанта не может аутентифицироваться в другом тенанте
    - _Требования: 7.3, 7.4, 7.5, 7.6, 7.11_

  - [ ]* 8.3 Написать property-тест: изоляция End User по тенанту
    - **Свойство 16: Изоляция End User по тенанту**
    - **Validates: Requirements 7.4, 7.11**
    - End User тенанта A не может аутентифицироваться в тенанте B

  - [ ]* 8.4 Написать property-тест: round-trip аутентификации End User-а
    - **Свойство 17: Аутентификация End User — round-trip**
    - **Validates: Requirements 7.5, 7.6**
    - После `register_end_user/2` вызов `authenticate_end_user/3` с теми же данными возвращает `{:ok, end_user}`

- [x] 9. ChatAuthController — API End User-а
  - [x] 9.1 Реализовать `ChatForgeWeb.ChatAuthController`
    - Создать `lib/chatforge_web/controllers/chat_auth_controller.ex`
    - `register/2`: использует `conn.assigns.tenant_id`, вызывает `Chat.register_end_user/2` + `Guardian.create_tokens/1`, возвращает HTTP 201
    - `login/2`: вызывает `Chat.authenticate_end_user/3`, возвращает HTTP 200 с токенами
    - `logout/2`: отзывает refresh-токен, возвращает HTTP 200
    - `me/2`: возвращает HTTP 200 с `conn.assigns.current_user`
    - _Требования: 7.7, 7.8, 7.9, 7.10_

  - [ ]* 9.2 Написать unit-тесты для ChatAuthController
    - `POST /api/v1/chat/auth/register`: 201 при валидных данных в контексте тенанта
    - `POST /api/v1/chat/auth/login`: 200 при корректных credentials, 401 при неверных
    - `GET /api/v1/chat/auth/me`: 200 с данными End User-а

- [x] 10. Router — обновить pipelines и маршруты
  - Обновить `lib/chatforge_web/router.ex`
  - Добавить pipeline `:authenticated` с `ChatForgeWeb.Plugs.AuthRequired`
  - Добавить pipeline `:chat_tenant` с `ChatForgeWeb.Plugs.TenantResolver`
  - Добавить публичные маршруты Creator-а: `POST /api/v1/auth/register`, `login`, `refresh`
  - Добавить защищённые маршруты Creator-а (через `:authenticated`): `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
  - Добавить маршруты End User-а (через `:chat_tenant`): `POST /api/v1/chat/auth/register`, `login`, `refresh`
  - Добавить защищённые маршруты End User-а (через `:chat_tenant, :authenticated`): `POST /api/v1/chat/auth/logout`, `GET /api/v1/chat/auth/me`
  - _Требования: 4.1–4.10, 5.6, 6.6, 7.7–7.10_

- [ ] 11. Checkpoint — убедиться, что все backend-тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 12. Frontend — типы и API-функции
  - [x] 12.1 Создать `features/auth/types.ts`
    - Типы `User`, `EndUser`, `AuthResponse`, `LoginCredentials`, `RegisterCredentials`
    - _Требования: 8.5_

  - [x] 12.2 Создать `features/auth/api.ts`
    - Типизированные функции: `register`, `login`, `logout`, `refresh`, `me` для Creator-а
    - Типизированные функции: `chatRegister`, `chatLogin`, `chatLogout`, `chatMe` для End User-а
    - Использует `API_Client` из `shared/lib/api.ts`
    - _Требования: 8.5_

- [x] 13. Frontend — Axios API-клиент с интерцепторами
  - Обновить `shared/lib/api.ts`
  - Request interceptor: добавляет `Authorization: Bearer <accessToken>` из `creatorAuthStore` или `endUserAuthStore` при наличии токена
  - Response interceptor: при HTTP 401 → `POST /api/v1/auth/refresh` → повтор исходного запроса с новым токеном
  - При ошибке refresh: очищает стор, перенаправляет на `/login`
  - Access-токен хранится только в памяти (не в `localStorage`/`sessionStorage`)
  - _Требования: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 13.1 Написать property-тест: API_Client добавляет Authorization header
    - **Свойство 18: API_Client добавляет Authorization header**
    - **Validates: Requirements 8.1**
    - При наличии токена в сторе каждый запрос содержит `Authorization: Bearer <token>`

  - [ ]* 13.2 Написать тест: API_Client автоматически обновляет токен при HTTP 401
    - **Свойство 19: API_Client автоматически обновляет токен при HTTP 401**
    - **Validates: Requirements 8.2, 8.3**
    - При 401 вызывается refresh, исходный запрос повторяется; при ошибке refresh — стор очищается

- [x] 14. Frontend — Zustand сторы аутентификации
  - [x] 14.1 Создать `features/auth/creatorAuthStore.ts`
    - Поля: `currentUser: User | null`, `isAuthenticated: boolean`, `accessToken: string | null`
    - Методы: `login(credentials)`, `logout()`, `setUser(user, token)`
    - `login` вызывает `api.login`, обновляет `currentUser`, `isAuthenticated`, `accessToken`
    - `logout` вызывает `api.logout`, очищает все поля
    - _Требования: 8.6, 8.7, 8.8_

  - [x] 14.2 Создать `features/auth/endUserAuthStore.ts`
    - Поля: `currentEndUser: EndUser | null`, `isAuthenticated: boolean`, `accessToken: string | null`
    - Методы: `login(credentials)`, `logout()`
    - Полностью изолирован от `creatorAuthStore`
    - _Требования: 10.3_

- [x] 15. Frontend — страницы аутентификации Creator-а
  - [x] 15.1 Реализовать `pages/platform/auth/LoginPage.tsx`
    - Форма с полями: email, пароль
    - Валидация через `react-hook-form` + `zod`
    - При успехе: вызывает `creatorAuthStore.login`, редирект на `/dashboard`
    - Серверные ошибки 422 отображаются через `setError` рядом с полями
    - _Требования: 9.2, 9.3, 9.5_

  - [x] 15.2 Реализовать `pages/platform/auth/RegisterPage.tsx`
    - Форма с полями: email, имя, пароль, повтор пароля, телефон (опционально), Telegram (опционально)
    - Валидация через `react-hook-form` + `zod` (включая совпадение паролей)
    - При невалидных данных: ошибки рядом с полями без отправки запроса
    - При успехе: редирект на `/dashboard`
    - _Требования: 9.1, 9.3, 9.4_

- [x] 16. Frontend — страницы аутентификации End User-а
  - [x] 16.1 Реализовать `pages/chat/auth/ChatLoginPage.tsx`
    - Форма с полями: email, пароль
    - Валидация через `react-hook-form` + `zod`
    - При успехе: вызывает `endUserAuthStore.login`, редирект на `/chat`
    - При невалидных данных: ошибки без отправки запроса
    - _Требования: 10.2, 10.4, 10.6, 10.7_

  - [x] 16.2 Реализовать `pages/chat/auth/ChatRegisterPage.tsx`
    - Форма с полями: email, имя, пароль
    - Валидация через `react-hook-form` + `zod`
    - _Требования: 10.1, 10.6_

- [x] 17. Frontend — роутинг с ProtectedRoute
  - Обновить `app/App.tsx`
  - Реализовать `ProtectedRoute` для Creator-а: проверяет `creatorAuthStore.isAuthenticated`; при `false` → `<Navigate to="/login" replace />`
  - Реализовать `AuthRoute` для Creator-а: при `true` → `<Navigate to="/dashboard" replace />`
  - Реализовать `ProtectedRoute` для End User-а: проверяет `endUserAuthStore.isAuthenticated`; при `false` → `<Navigate to="/chat/login" replace />`
  - Защитить маршруты `/dashboard` и вложенные через `ProtectedRoute` Creator-а
  - Защитить маршрут `/chat` через `ProtectedRoute` End User-а
  - Обернуть `/login` и `/register` в `AuthRoute`
  - _Требования: 9.5, 9.6, 9.7, 9.8, 10.4, 10.5_

  - [ ]* 17.1 Написать property-тест: защищённые маршруты перенаправляют неаутентифицированных
    - **Свойство 20: Защищённые маршруты перенаправляют неаутентифицированных пользователей**
    - **Validates: Requirements 9.7, 9.8, 10.5**
    - Неаутентифицированный пользователь на `/dashboard` → редирект на `/login`
    - Аутентифицированный пользователь на `/login` → редирект на `/dashboard`

  - [ ]* 17.2 Написать тест: изоляция сторов Creator-а и End User-а
    - Логин как End User не влияет на `creatorAuthStore`
    - _Требования: 10.3_

- [ ] 18. Финальный checkpoint — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

## Примечания

- Задачи с `*` опциональны и могут быть пропущены для ускорения MVP
- Каждая задача ссылается на конкретные требования для трассируемости
- Property-тесты используют `stream_data`, минимум 100 итераций (`max_runs: 100`)
- Frontend-тесты используют Vitest + Testing Library
- Запуск backend-тестов: `mix test`; frontend-тестов: `cd frontend && npx vitest --run`
