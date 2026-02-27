# Phase 1 — Тесты и проверки

**Статус:** ✅ Все проверки пройдены

---

## Подготовка

1. Docker Desktop запущен
2. Visual Studio Build Tools установлен (нужен для bcrypt_elixir на Windows)
3. PostgreSQL доступен на порту 5433 (пользователь/пароль: `chatforge`)
4. Node.js установлен

---

## Чеклист

### Инфраструктура
- [x] `docker compose up -d` — все контейнеры поднялись без ошибок (postgres, redis, minio, traefik)
- [x] PostgreSQL доступен на порту 5433
- [x] Redis доступен на порту 6379
- [x] MinIO доступен на портах 9000/9001

### База данных
- [x] `mix ecto.create` — БД создана
- [x] `mix ecto.migrate` — все 10 миграций применены без ошибок
- [x] Таблицы созданы: users, chat_instances, instance_settings, end_users, conversations, messages, subscription_plans, subscriptions, ai_usage_logs, events
- [x] Уникальные индексы: users.email, chat_instances.subdomain, (end_users.email, end_users.chat_instance_id)
- [x] Повторный запуск `mix ecto.migrate` — идемпотентен (no migrations to run)

### Backend
- [x] `mix compile` — компилируется без ошибок
- [x] `GET /health` → `{"status":"ok","timestamp":"..."}` — отвечает корректно
- [x] Логи не содержат критических ошибок при старте

### Frontend
- [x] `npm install` — зависимости установлены без ошибок
- [x] `npm run build` — сборка проходит чисто
- [x] shadcn/ui настроен: `components.json` корректен, `button.tsx` доступен по `@/shared/ui/button`
- [x] TypeScript paths (`@/*`) резолвятся корректно

---

## Результаты тестирования

- ✅ Health-check `GET /health` возвращает `{"status":"ok","timestamp":"..."}`
- ✅ Все 10 миграций применены успешно
- ✅ `npm run build` проходит без ошибок и предупреждений
- ✅ Phoenix компилируется с исправленным багом `layouts: []`
