# Phase 2 — Что сделано

**Дата завершения:** 2026-02-26
**Статус:** ✅ Завершена

---

## Реализовано

### Backend — Accounts (Creator)
- Схема `ChatForge.Accounts.User` с changesets регистрации и логина
- `Accounts.register_creator/1`, `authenticate/2`, `get_user!/1`, `get_user_by_email/1`
- Хэширование паролей через `bcrypt_elixir`

### Backend — Guardian JWT + Redis
- `ChatForge.Guardian` с `create_tokens/1`, `refresh_tokens/1`, `revoke_refresh_token/1`
- Access-токен TTL 15 минут, refresh-токен TTL 30 дней в Redis
- Ротация refresh-токенов при обновлении
- Ключи Redis: `{user_id}:refresh:{token_hash}`

### Backend — Plugs
- `ChatForgeWeb.Plugs.AuthRequired` — проверка Bearer-токена, установка `current_user`
- `ChatForgeWeb.Plugs.RequireRole` — проверка роли пользователя
- `ChatForgeWeb.Plugs.TenantResolver` — резолвинг поддомена с Redis-кешем (TTL 5 мин)

### Backend — Controllers
- `ChatForgeWeb.AuthController`: register, login, logout, refresh, me
- `ChatForgeWeb.ChatAuthController`: register, login, logout, me (tenant-scoped)

### Backend — Router
- Pipeline `:authenticated` с `AuthRequired`
- Pipeline `:chat_tenant` с `TenantResolver`
- Все маршруты `/api/v1/auth/*` и `/api/v1/chat/auth/*`

### Backend — Chat (End User)
- Схема `ChatForge.Chat.EndUser` с changeset регистрации
- `Chat.register_end_user/2`, `authenticate_end_user/3`
- Уникальность email в рамках тенанта (constraint `:end_users_email_instance_index`)

### Frontend — API-клиент
- `shared/lib/api.ts` — Axios с `withCredentials: true`
- Request interceptor: `Authorization: Bearer` из памяти (не localStorage)
- Response interceptor: при 401 → refresh → повтор запроса; при ошибке → logout + redirect
- Реестр геттеров токенов для разрыва циклических зависимостей

### Frontend — Zustand сторы
- `features/auth/creatorAuthStore.ts` — стор Creator-а (login, register, logout, setUser, clear)
- `features/auth/endUserAuthStore.ts` — стор End User-а (login, logout, setEndUser, clear)
- Полная изоляция сторов друг от друга

### Frontend — Страницы
- `pages/platform/auth/LoginPage.tsx` — форма входа Creator-а (react-hook-form + zod)
- `pages/platform/auth/RegisterPage.tsx` — форма регистрации Creator-а (все поля + валидация)
- `pages/chat/auth/ChatLoginPage.tsx` — форма входа End User-а
- `pages/chat/auth/ChatRegisterPage.tsx` — форма регистрации End User-а

### Frontend — Роутинг
- `app/App.tsx` — `CreatorProtectedRoute`, `CreatorAuthRoute`, `EndUserProtectedRoute`
- Защищены: `/dashboard`, `/builder` (Creator), `/chat/*` (End User)
- AuthRoute для `/login`, `/register` (редирект если уже авторизован)

---

## Известные ограничения

- Refresh-токен передаётся в теле запроса (не в httpOnly cookie) — осознанное решение
- Property-тесты (опциональные задачи) не реализованы — отложены как MVP-ускорение
- Backend unit-тесты (опциональные задачи 7.2, 9.2) не реализованы
- Требование 6.7 (инвалидация кеша тенанта при обновлении `ChatInstance`) не реализовано — кеш истекает через 5 минут автоматически

---

## Исправления после QA-проверки (2026-02-26)

- ✅ Добавлен маршрут `POST /api/v1/chat/auth/refresh` в роутер (был пропущен)
- ✅ `POST /api/v1/chat/auth/logout` перенесён в публичный pipeline (не требует auth)
- ✅ `api.ts` request interceptor: изоляция токенов по URL (`/api/v1/chat/*` → End User токен, остальное → Creator токен)
- ✅ `api.ts` response interceptor: защита от refresh loop — при 401 на `/auth/refresh` сразу logout без рекурсии
- ✅ `guardian.ex`: `resource_from_claims` для Creator использует `get_user_by_id/1` вместо `get_user!/1` (без исключений)
- ✅ `accounts.ex`: добавлена функция `get_user_by_id/1`
- ✅ `chat_auth_controller.ex`: различение 422 (дубликат email) и 400 (ошибки валидации)
- ✅ `api.ts` response interceptor: определение контекста (Creator/EndUser) по URL запроса вместо наличия токена в памяти

---

## Технический долг

- `TenantResolver` обращается к `Repo` и `ChatInstance` напрямую — нарушение архитектурных границ. Должен использовать `Instances.get_instance_by_subdomain/1`. Будет исправлено в Phase 3 при реализации задачи 3.2.

---

## Что НЕ входило в эту фазу

- OAuth и социальные логины
- Восстановление пароля
- Визард создания чата
- AI-интеграция
- Подписки и монетизация
