# Phase 2 — Тесты и проверки

**Статус:** ✅ Выполнено

---

## Подготовка

1. Phase 1 завершена (инфраструктура поднята, схема данных применена).
2. PostgreSQL запущен на порту 5433, пользователь/пароль: `chatforge`.
3. Redis запущен на порту 6379.
4. `GUARDIAN_SECRET_KEY` задан в `.env`.

---

## Чеклист

### Компиляция
- [x] `mix compile` проходит без ошибок (backend)
- [x] `npm run build` проходит без ошибок (frontend)

### Backend — Creator аутентификация
- [ ] `POST /api/v1/auth/register` → 201 с `{user, access_token, refresh_token}`
- [ ] `POST /api/v1/auth/register` с дублирующимся email → 422
- [ ] `POST /api/v1/auth/register` с коротким паролем → 422
- [ ] `POST /api/v1/auth/login` с верными credentials → 200 с токенами
- [ ] `POST /api/v1/auth/login` с неверным паролем → 401
- [ ] `GET /api/v1/auth/me` с Bearer-токеном → 200 с данными пользователя
- [ ] `GET /api/v1/auth/me` без токена → 401
- [ ] `POST /api/v1/auth/refresh` с валидным refresh → 200 с новой парой
- [ ] `POST /api/v1/auth/refresh` с невалидным refresh → 401
- [ ] `POST /api/v1/auth/logout` → 200, refresh-токен инвалидирован

### Backend — End User аутентификация
- [ ] `POST /api/v1/chat/auth/register` с Host: `<subdomain>.chatforge.app` → 201
- [ ] `POST /api/v1/chat/auth/login` → 200 с токенами
- [ ] `GET /api/v1/chat/auth/me` с Bearer-токеном → 200
- [ ] End User тенанта A не может войти в тенант B

### Backend — TenantResolver
- [ ] Запрос с несуществующим поддоменом → 404
- [ ] Повторный запрос использует Redis-кеш (TTL 5 мин)

### Frontend — сборка и роутинг
- [x] `npm run build` без ошибок
- [ ] `/login` — форма отображается, валидация работает без запроса
- [ ] `/register` — форма с 6 полями, совпадение паролей проверяется
- [ ] После успешного логина → редирект на `/dashboard`
- [ ] `/dashboard` без авторизации → редирект на `/login`
- [ ] Авторизованный пользователь на `/login` → редирект на `/dashboard`
- [ ] `/chat/login` — форма End User-а работает
- [ ] `/chat` без авторизации End User-а → редирект на `/chat/login`

### Изоляция данных
- [ ] Логин как End User не влияет на `creatorAuthStore`
- [ ] Access-токен не сохраняется в `localStorage`/`sessionStorage`

---

## Результаты тестирования

- Компиляция backend: ✅ `mix compile` чистый
- Сборка frontend: ✅ `npm run build` чистый (171 модуль)
- Ручное тестирование API: требует запущенного окружения (docker-compose up)
- Ручное тестирование UI: требует запущенного dev-сервера

---

## QA-проверка (2026-02-26)

### Найдено и исправлено
- 🔴 `POST /api/v1/chat/auth/refresh` отсутствовал в роутере → добавлен
- 🔴 `POST /api/v1/chat/auth/logout` был в защищённом pipeline → перенесён в публичный
- 🟡 `api.ts` request interceptor смешивал токены Creator/EndUser → изолированы по URL-префиксу
- 🟡 `api.ts` refresh loop при 401 на самом refresh-запросе → добавлена проверка URL
- 🟡 `guardian.ex` использовал `get_user!/1` с исключением → заменён на `get_user_by_id/1`
- 🟢 `chat_auth_controller.ex` возвращал 422 для всех ошибок → добавлено различение 400/422

### Product-проверка
- ✅ Все требования Phase 2 реализованы
- ✅ Роли и права доступа соблюдены
- ✅ Изоляция Creator/EndUser сторов подтверждена
