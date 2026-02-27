# Требования — ChatForge Phase 2: Аутентификация

## Введение

Phase 2 реализует полный цикл аутентификации для двух типов пользователей платформы ChatForge:
- **Creator-ы** — пользователи платформы, регистрирующиеся на `chatforge.app`.
- **End Users** — конечные пользователи чат-инстансов, регистрирующиеся на `<subdomain>.chatforge.app`.

После завершения фазы: Creator может зарегистрироваться, войти и выйти; End User может зарегистрироваться и войти в рамках своего тенанта; JWT-токены работают; tenant резолвится по поддомену; фронтенд хранит токены безопасно и автоматически обновляет их.

Фаза не включает: OAuth, социальные логины, восстановление пароля, визард создания чата, AI-интеграцию, подписки.

---

## Глоссарий

- **System** — платформа ChatForge в целом.
- **Accounts_Context** — Elixir bounded context `ChatForge.Accounts`, отвечающий за Creator-ов.
- **Chat_Context** — Elixir bounded context `ChatForge.Chat`, отвечающий за End User-ов и диалоги.
- **Guardian** — библиотека JWT-аутентификации для Elixir (`ChatForge.Guardian`).
- **Redis** — хранилище кеша и сессий (refresh-токены, кеш тенантов).
- **Creator** — пользователь платформы с ролью `creator`, создающий AI-чатботы.
- **End_User** — конечный пользователь чат-инстанса, зарегистрированный в рамках одного тенанта.
- **Access_Token** — короткоживущий JWT (TTL 15 минут), передаётся в `Authorization: Bearer` header.
- **Refresh_Token** — долгоживущий токен (TTL 30 дней), хранится в Redis и httpOnly cookie.
- **Tenant** — изолированный чат-инстанс, идентифицируемый по `chat_instance_id`.
- **TenantResolver** — Plug, определяющий текущий тенант по поддомену из Host header.
- **AuthRequired** — Plug, проверяющий Bearer-токен и устанавливающий `current_user` в `conn.assigns`.
- **RequireRole** — Plug, проверяющий роль текущего пользователя.
- **API_Client** — Axios-инстанс на фронтенде с настроенными интерцепторами.
- **Creator_Auth_Store** — Zustand-стор для состояния аутентификации Creator-а.
- **EndUser_Auth_Store** — Zustand-стор для состояния аутентификации End User-а.
- **Router** — Phoenix Router, маршрутизатор HTTP-запросов.
- **Frontend_Router** — React Router, маршрутизатор фронтенда.

---

## Требования

### Требование 1: Accounts — Ecto-схема и changeset для Creator-а

**User Story:** Как разработчик, я хочу иметь Ecto-схему и changesets для пользователей платформы, чтобы безопасно создавать и валидировать данные Creator-ов.

#### Критерии приёмки

1. THE Accounts_Context SHALL содержать схему `ChatForge.Accounts.User`, отображающую таблицу `users` с полями: `id`, `email`, `password_hash`, `name`, `phone`, `telegram`, `role`, `inserted_at`, `updated_at`.
2. THE Accounts_Context SHALL содержать changeset регистрации, валидирующий: формат email, уникальность email, минимальную длину пароля 8 символов, обязательность полей `email`, `name`, `password`.
3. THE Accounts_Context SHALL содержать changeset логина, принимающий только поля `email` и `password`.
4. WHEN changeset регистрации вызывается с корректными данными, THE Accounts_Context SHALL вернуть валидный changeset без ошибок.
5. IF email уже существует в таблице `users`, THEN THE Accounts_Context SHALL вернуть changeset с ошибкой уникальности на поле `email`.
6. IF пароль содержит менее 8 символов, THEN THE Accounts_Context SHALL вернуть changeset с ошибкой валидации на поле `password`.
7. THE Accounts_Context SHALL содержать функцию `hash_password/1`, хэширующую пароль через `bcrypt_elixir` и возвращающую хэш-строку.
8. WHEN `hash_password/1` вызывается с одинаковым паролем дважды, THE Accounts_Context SHALL вернуть разные хэши (bcrypt salt).

---

### Требование 2: Accounts — бизнес-логика Creator-а

**User Story:** Как разработчик, я хочу иметь публичные функции контекста Accounts для регистрации и аутентификации Creator-ов, чтобы контроллеры могли вызывать их без знания деталей реализации.

#### Критерии приёмки

1. WHEN `Accounts.register_creator/1` вызывается с валидными данными, THE Accounts_Context SHALL создать пользователя с ролью `creator` в таблице `users` и вернуть `{:ok, user}`.
2. IF `Accounts.register_creator/1` вызывается с невалидными данными, THEN THE Accounts_Context SHALL вернуть `{:error, changeset}` без создания записи в БД.
3. WHEN `Accounts.authenticate/2` вызывается с корректными email и паролем, THE Accounts_Context SHALL вернуть `{:ok, user}`.
4. IF `Accounts.authenticate/2` вызывается с неверным паролем или несуществующим email, THEN THE Accounts_Context SHALL вернуть `{:error, :invalid_credentials}`.
5. WHEN `Accounts.get_user!/1` вызывается с существующим `id`, THE Accounts_Context SHALL вернуть структуру `User`.
6. IF `Accounts.get_user!/1` вызывается с несуществующим `id`, THEN THE Accounts_Context SHALL выбросить исключение `Ecto.NoResultsError`.
7. WHEN `Accounts.get_user_by_email/1` вызывается с существующим email, THE Accounts_Context SHALL вернуть структуру `User`.
8. WHEN `Accounts.get_user_by_email/1` вызывается с несуществующим email, THE Accounts_Context SHALL вернуть `nil`.

---

### Требование 3: JWT — управление токенами

**User Story:** Как разработчик, я хочу иметь надёжную систему JWT-токенов с автоматическим обновлением, чтобы Creator-ы оставались авторизованными без повторного ввода пароля.

#### Критерии приёмки

1. THE Guardian SHALL быть настроен с секретом из переменной окружения `GUARDIAN_SECRET_KEY` и TTL access-токена 15 минут.
2. WHEN `Guardian.create_tokens/1` вызывается с валидным `user`, THE Guardian SHALL вернуть `{:ok, access_token, refresh_token}`.
3. THE Guardian SHALL сохранить refresh-токен в Redis по ключу `{user_id}:refresh:{token_hash}` с TTL 30 дней.
4. WHEN `Guardian.refresh_tokens/1` вызывается с валидным refresh-токеном, THE Guardian SHALL проверить его наличие в Redis, выдать новую пару токенов и инвалидировать старый refresh-токен в Redis.
5. IF `Guardian.refresh_tokens/1` вызывается с refresh-токеном, отсутствующим в Redis, THEN THE Guardian SHALL вернуть `{:error, :invalid_token}`.
6. WHEN `Guardian.revoke_refresh_token/1` вызывается с валидным refresh-токеном, THE Guardian SHALL удалить соответствующую запись из Redis.
7. IF `Guardian.revoke_refresh_token/1` вызывается с уже отозванным токеном, THEN THE Guardian SHALL вернуть `{:ok}` без ошибки (идемпотентность).
8. FOR ALL валидных refresh-токенов: создание новой пары через `refresh_tokens/1` SHALL инвалидировать предыдущий refresh-токен (ротация токенов).

---

### Требование 4: Accounts — API контроллер Creator-а

**User Story:** Как Creator, я хочу иметь REST API для регистрации, входа, выхода и получения своего профиля, чтобы фронтенд мог управлять моей сессией.

#### Критерии приёмки

1. WHEN `POST /api/v1/auth/register` получает валидные данные, THE Router SHALL создать Creator-а и вернуть HTTP 201 с телом `{user, access_token, refresh_token}`.
2. IF `POST /api/v1/auth/register` получает данные с уже существующим email, THEN THE Router SHALL вернуть HTTP 422 с описанием ошибки.
3. IF `POST /api/v1/auth/register` получает данные с невалидными полями, THEN THE Router SHALL вернуть HTTP 400 с описанием ошибок валидации.
4. WHEN `POST /api/v1/auth/login` получает корректные email и пароль, THE Router SHALL вернуть HTTP 200 с телом `{user, access_token, refresh_token}`.
5. IF `POST /api/v1/auth/login` получает неверные credentials, THEN THE Router SHALL вернуть HTTP 401 с сообщением об ошибке.
6. WHEN `POST /api/v1/auth/logout` получает валидный refresh-токен, THE Router SHALL отозвать его и вернуть HTTP 200.
7. WHEN `POST /api/v1/auth/refresh` получает валидный refresh-токен, THE Router SHALL вернуть HTTP 200 с новой парой `{access_token, refresh_token}`.
8. IF `POST /api/v1/auth/refresh` получает невалидный или отозванный refresh-токен, THEN THE Router SHALL вернуть HTTP 401.
9. WHEN `GET /api/v1/auth/me` получает запрос с валидным Bearer-токеном, THE Router SHALL вернуть HTTP 200 с данными текущего Creator-а.
10. IF `GET /api/v1/auth/me` получает запрос без токена или с невалидным токеном, THEN THE Router SHALL вернуть HTTP 401.

---

### Требование 5: Auth Plug — защита маршрутов

**User Story:** Как разработчик, я хочу иметь Plug-и для защиты маршрутов, чтобы неавторизованные запросы автоматически отклонялись.

#### Критерии приёмки

1. WHEN `AuthRequired` Plug получает запрос с валидным `Authorization: Bearer <token>` header, THE AuthRequired SHALL декодировать токен, загрузить пользователя и положить его в `conn.assigns.current_user`.
2. IF `AuthRequired` Plug получает запрос без `Authorization` header, THEN THE AuthRequired SHALL вернуть HTTP 401 и остановить выполнение pipeline.
3. IF `AuthRequired` Plug получает запрос с истёкшим или невалидным токеном, THEN THE AuthRequired SHALL вернуть HTTP 401 и остановить выполнение pipeline.
4. WHEN `RequireRole` Plug получает запрос от пользователя с требуемой ролью, THE RequireRole SHALL пропустить запрос дальше по pipeline.
5. IF `RequireRole` Plug получает запрос от пользователя с недостаточной ролью, THEN THE RequireRole SHALL вернуть HTTP 403 и остановить выполнение pipeline.
6. THE Router SHALL содержать pipeline `:authenticated`, включающий `AuthRequired` Plug.

---

### Требование 6: TenantResolver Plug

**User Story:** Как разработчик, я хочу иметь Plug для автоматического определения тенанта по поддомену, чтобы все запросы к чат-инстансу содержали корректный `tenant_id`.

#### Критерии приёмки

1. WHEN `TenantResolver` Plug получает запрос с Host header вида `<subdomain>.chatforge.app`, THE TenantResolver SHALL извлечь поддомен и найти соответствующий `ChatInstance` в БД.
2. WHEN `ChatInstance` найден, THE TenantResolver SHALL положить `tenant_id` и `chat_instance` в `conn.assigns` и передать запрос дальше.
3. THE TenantResolver SHALL кешировать результат поиска `ChatInstance` в Redis по ключу `tenant:<subdomain>` с TTL 5 минут.
4. WHEN кеш содержит запись для поддомена, THE TenantResolver SHALL использовать кешированное значение без обращения к БД.
5. IF поддомен не найден в БД, THEN THE TenantResolver SHALL вернуть HTTP 404 и остановить выполнение pipeline.
6. THE Router SHALL содержать pipeline `:chat_tenant`, включающий `TenantResolver` Plug.
7. WHEN `ChatInstance` обновляется или деактивируется, THE TenantResolver SHALL инвалидировать соответствующую запись в кеше Redis.

---

### Требование 7: Chat — аутентификация End User-ов

**User Story:** Как End User, я хочу регистрироваться и входить в чат-инстанс, чтобы получить доступ к AI-чату в рамках своего тенанта.

#### Критерии приёмки

1. THE Chat_Context SHALL содержать схему `ChatForge.Chat.EndUser`, отображающую таблицу `end_users` с полями: `id`, `chat_instance_id`, `email`, `password_hash`, `name`, `messages_used`, `inserted_at`, `updated_at`.
2. THE Chat_Context SHALL содержать changeset регистрации End User-а, валидирующий: формат email, уникальность email в рамках одного `chat_instance_id`, минимальную длину пароля 8 символов, обязательность полей `email`, `name`, `password`.
3. WHEN `Chat.register_end_user/2` вызывается с валидными данными и существующим `tenant_id`, THE Chat_Context SHALL создать `EndUser` с привязкой к тенанту и вернуть `{:ok, end_user}`.
4. IF `Chat.register_end_user/2` вызывается с email, уже существующим в рамках данного `tenant_id`, THEN THE Chat_Context SHALL вернуть `{:error, changeset}`.
5. WHEN `Chat.authenticate_end_user/3` вызывается с корректными `tenant_id`, email и паролем, THE Chat_Context SHALL вернуть `{:ok, end_user}`.
6. IF `Chat.authenticate_end_user/3` вызывается с неверными credentials, THEN THE Chat_Context SHALL вернуть `{:error, :invalid_credentials}`.
7. WHEN `POST /api/v1/chat/auth/register` получает валидные данные в контексте тенанта, THE Router SHALL создать End User-а и вернуть HTTP 201 с `{end_user, access_token, refresh_token}`.
8. WHEN `POST /api/v1/chat/auth/login` получает корректные credentials в контексте тенанта, THE Router SHALL вернуть HTTP 200 с `{end_user, access_token, refresh_token}`.
9. WHEN `POST /api/v1/chat/auth/logout` получает валидный refresh-токен, THE Router SHALL отозвать его и вернуть HTTP 200.
10. WHEN `GET /api/v1/chat/auth/me` получает запрос с валидным Bearer-токеном, THE Router SHALL вернуть HTTP 200 с данными текущего End User-а.
11. THE Chat_Context SHALL обеспечить, что End User одного тенанта не может аутентифицироваться в другом тенанте.

---

### Требование 8: Frontend — API-клиент и хранение токенов

**User Story:** Как разработчик, я хочу иметь настроенный API-клиент с автоматическим управлением токенами, чтобы фронтенд безопасно взаимодействовал с бэкендом.

#### Критерии приёмки

1. THE API_Client SHALL добавлять заголовок `Authorization: Bearer <access_token>` к каждому исходящему запросу, если access-токен присутствует в памяти.
2. WHEN API_Client получает ответ HTTP 401, THE API_Client SHALL автоматически вызвать `POST /api/v1/auth/refresh` с refresh-токеном из httpOnly cookie и повторить исходный запрос с новым access-токеном.
3. IF обновление токена завершается ошибкой, THEN THE API_Client SHALL очистить состояние аутентификации и перенаправить пользователя на страницу логина.
4. THE API_Client SHALL хранить access-токен исключительно в памяти приложения (не в `localStorage`, не в `sessionStorage`).
5. THE API_Client SHALL содержать типизированные функции для всех auth-эндпоинтов: `register`, `login`, `logout`, `refresh`, `me`.
6. THE Creator_Auth_Store SHALL содержать поля: `currentUser`, `isAuthenticated`, `accessToken` и методы: `login`, `logout`, `setUser`.
7. WHEN `Creator_Auth_Store.login` вызывается с валидными credentials, THE Creator_Auth_Store SHALL обновить `currentUser`, `isAuthenticated` и `accessToken`.
8. WHEN `Creator_Auth_Store.logout` вызывается, THE Creator_Auth_Store SHALL очистить `currentUser`, `isAuthenticated` и `accessToken`.

---

### Требование 9: Frontend — страницы аутентификации Creator-а

**User Story:** Как Creator, я хочу иметь страницы регистрации и входа с валидацией форм, чтобы создать аккаунт и войти в платформу.

#### Критерии приёмки

1. THE Frontend_Router SHALL содержать страницу `/register` с формой: email, имя, пароль, повтор пароля, телефон (опционально), Telegram (опционально).
2. THE Frontend_Router SHALL содержать страницу `/login` с формой: email, пароль.
3. THE Frontend_Router SHALL использовать `react-hook-form` и `zod` для валидации всех форм аутентификации Creator-а.
4. IF форма регистрации отправлена с невалидными данными, THEN THE Frontend_Router SHALL отобразить сообщения об ошибках рядом с соответствующими полями без отправки запроса на сервер.
5. WHEN Creator успешно входит, THE Frontend_Router SHALL перенаправить его на `/dashboard`.
6. WHEN Creator выходит из системы, THE Frontend_Router SHALL перенаправить его на `/login`.
7. WHILE Creator не аутентифицирован, THE Frontend_Router SHALL перенаправлять запросы к `/dashboard` и вложенным маршрутам на `/login`.
8. WHILE Creator аутентифицирован, THE Frontend_Router SHALL перенаправлять запросы к `/login` и `/register` на `/dashboard`.

---

### Требование 10: Frontend — страницы аутентификации End User-а

**User Story:** Как End User, я хочу иметь страницы регистрации и входа в чат-инстанс, чтобы получить доступ к AI-чату.

#### Критерии приёмки

1. THE Frontend_Router SHALL содержать страницу `/chat/register` с формой: email, имя, пароль.
2. THE Frontend_Router SHALL содержать страницу `/chat/login` с формой: email, пароль.
3. THE EndUser_Auth_Store SHALL быть полностью изолирован от `Creator_Auth_Store`: иметь собственные поля `currentEndUser`, `isAuthenticated`, `accessToken` и методы `login`, `logout`.
4. WHEN End User успешно входит, THE Frontend_Router SHALL перенаправить его на `/chat`.
5. WHILE End User не аутентифицирован, THE Frontend_Router SHALL перенаправлять запросы к `/chat` на `/chat/login`.
6. THE Frontend_Router SHALL использовать `react-hook-form` и `zod` для валидации форм аутентификации End User-а.
7. IF форма входа End User-а отправлена с невалидными данными, THEN THE Frontend_Router SHALL отобразить сообщения об ошибках без отправки запроса на сервер.

