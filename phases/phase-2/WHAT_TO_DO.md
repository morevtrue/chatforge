# Phase 2 — Аутентификация

**Название фазы:** Аутентификация Creator-ов и конечных пользователей
**Статус:** ✅ Завершена

---

## Цель фазы

Полный цикл аутентификации для Creator-ов (платформа) и End Users (инстансы чатов).
После этой фазы — можно зарегистрироваться, войти, выйти, токены работают, tenant резолвится.

---

## Задачи

### 2.1 Accounts — Ecto-схема и changeset
- [ ] Создать схему `ChatForge.Accounts.User` (поля из миграции)
- [ ] Changeset для регистрации: валидация email (формат, уникальность), пароль (мин. 8 символов), обязательные поля
- [ ] Changeset для логина: только email + пароль
- [ ] Функция `hash_password/1` через `bcrypt_elixir`

### 2.2 Accounts — бизнес-логика
- [ ] `Accounts.register_creator/1` — создать пользователя с ролью `:creator`
- [ ] `Accounts.authenticate/2` — проверить email + пароль, вернуть `{:ok, user}` или `{:error, :invalid_credentials}`
- [ ] `Accounts.get_user!/1` — получить пользователя по id
- [ ] `Accounts.get_user_by_email/1` — получить пользователя по email

### 2.3 JWT — токены
- [ ] Настроить Guardian (`ChatForge.Guardian`): secret из env, TTL access 15 мин
- [ ] Функция `create_tokens/1` — создать access + refresh токен
- [ ] Refresh token: сохранить в Redis с TTL 30 дней (`{user_id}:refresh:{token_hash}`)
- [ ] Функция `refresh_tokens/1` — проверить refresh в Redis, выдать новую пару
- [ ] Функция `revoke_refresh_token/1` — удалить из Redis при логауте

### 2.4 Accounts — API контроллер
- [ ] `POST /api/v1/auth/register` — регистрация, возвращает `{user, access_token, refresh_token}`
- [ ] `POST /api/v1/auth/login` — логин, возвращает `{user, access_token, refresh_token}`
- [ ] `POST /api/v1/auth/logout` — инвалидировать refresh token
- [ ] `POST /api/v1/auth/refresh` — обновить access token по refresh
- [ ] `GET /api/v1/auth/me` — текущий пользователь (требует auth)
- [ ] Обработка ошибок: 400 (валидация), 401 (неверные данные), 422 (дубликат email)

### 2.5 Auth Plug — защита маршрутов
- [ ] Plug `ChatForgeWeb.Plugs.AuthRequired` — проверить Bearer токен, положить `current_user` в `conn.assigns`
- [ ] Plug `ChatForgeWeb.Plugs.RequireRole` — проверить роль пользователя
- [ ] Подключить в pipeline `:authenticated` в роутере

### 2.6 TenantResolver Plug
- [ ] Plug `ChatForgeWeb.Plugs.TenantResolver` — извлечь поддомен из Host header
- [ ] Найти `ChatInstance` по поддомену (с кешем в Redis, TTL 5 мин)
- [ ] Положить `tenant_id` и `chat_instance` в `conn.assigns`
- [ ] Вернуть 404 если поддомен не найден
- [ ] Подключить в pipeline `:chat_tenant` в роутере

### 2.7 Chat — аутентификация End Users
- [ ] Создать схему `ChatForge.Chat.EndUser`
- [ ] Changeset для регистрации End User (email уникален в рамках tenant)
- [ ] `Chat.register_end_user/2` — создать end_user для конкретного tenant
- [ ] `Chat.authenticate_end_user/3` — проверить credentials в рамках tenant
- [ ] `POST /api/v1/chat/auth/register` — tenant-scoped регистрация
- [ ] `POST /api/v1/chat/auth/login` — tenant-scoped логин
- [ ] `POST /api/v1/chat/auth/logout` — логаут
- [ ] `GET /api/v1/chat/auth/me` — текущий end_user

### 2.8 Frontend — API-клиент и хранение токенов
- [ ] Настроить axios interceptor: добавлять `Authorization: Bearer <token>` к запросам
- [ ] Настроить axios interceptor: при 401 — автоматически вызвать `/auth/refresh` и повторить запрос
- [ ] Хранить access token в памяти (не в localStorage), refresh token в httpOnly cookie
- [ ] Создать `src/shared/lib/api.ts` — типизированные функции для auth endpoints
- [ ] Создать `src/features/auth/store.ts` (Zustand) — `currentUser`, `isAuthenticated`, `login`, `logout`

### 2.9 Frontend — страницы платформы (Creator)
- [ ] Страница `/register` — форма: email, имя, пароль, повтор пароля, телефон, Telegram
- [ ] Страница `/login` — форма: email, пароль
- [ ] Валидация форм через `react-hook-form` + `zod`
- [ ] После логина — редирект на `/dashboard`
- [ ] После логаута — редирект на `/login`
- [ ] Protected route: `/dashboard` и вложенные — только для авторизованных

### 2.10 Frontend — страницы чата (End User)
- [ ] Страница `/chat/register` — форма: email, имя, пароль
- [ ] Страница `/chat/login` — форма: email, пароль
- [ ] Отдельный auth store для end_user (изолирован от creator store)
- [ ] После логина — редирект на `/chat`
- [ ] Protected route: `/chat` — только для авторизованных end_users

---

## Ограничения

- НЕ входит: визард создания чата, AI-интеграция, подписки.
- НЕ входит: OAuth, социальные логины.
- НЕ входит: восстановление пароля.

---

## Ссылки

- Архитектура: `sources-of-truth/ARCHITECTURE.md`
- Бизнес-логика: `sources-of-truth/BUSINESS_SPEC.md`
