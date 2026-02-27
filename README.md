# ChatForge

Платформа-конструктор AI-чатботов. Создай свой аналог ChatGPT за несколько минут — с брендингом, подписками и монетизацией.

---

## Что это

ChatForge позволяет любому человеку без навыков программирования:
- Создать AI-чат через пошаговый визард (цвета, название, аватар, приветствие).
- Получить готовое приложение на собственном поддомене (`mybot.chatforge.app`).
- Продавать доступ к AI-чату через систему подписок с paywall.

Два уровня пользователей:
- **Creator** — регистрируется на платформе, создаёт и настраивает AI-чат.
- **End User** — клиент Creator-а, общается с AI, оформляет подписку.

---

## Стек

| Слой       | Технология                                |
|------------|-------------------------------------------|
| Backend    | Elixir / Phoenix (modular monolith)       |
| Frontend   | React / TypeScript / Vite                 |
| БД         | PostgreSQL 16+                            |
| Кеш        | Redis 7+                                  |
| Файлы      | S3-совместимое (MinIO)                    |
| Real-time  | Phoenix Channels (WebSocket)              |
| Proxy      | Traefik 3+                                |

---

## Локальная разработка

### Требования

- Docker + Docker Compose
- Elixir 1.17+ / Erlang 26+
- Node.js 20+ / npm

### Запуск

```bash
# 1. Скопировать и заполнить переменные окружения
cp .env.example .env

# 2. Поднять инфраструктуру (PostgreSQL, Redis, MinIO, Traefik, Backend)
docker compose up -d

# 3. Фронтенд (в отдельном терминале)
cd frontend
npm install
npm run dev
```

Фронтенд: `http://localhost:5173`
Бэкенд: `http://localhost:4000`
Health-check: `GET http://localhost:4000/health`
MinIO консоль: `http://localhost:9001`

### Super Admin

```bash
# Создать super_admin аккаунт (выполнить после первого запуска)
docker exec -it chatforge_backend mix run priv/repo/seeds.exs
```

По умолчанию создаётся `admin@chatforge.dev` / `Admin1234!`. Переопределить через env:

```bash
docker exec -it chatforge_backend sh -c "SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=Secret123! mix run priv/repo/seeds.exs"
```

---

## Деплой на сервер

### Требования к серверу

- VPS/VDS с KVM-виртуализацией
- 4 GB RAM минимум
- Ubuntu 22.04+
- Docker + Docker Compose

### Установка Docker на сервере

```bash
curl -fsSL https://get.docker.com | sh
```

### Запуск

```bash
# 1. Клонировать репозиторий
git clone <repo> /opt/chatforge
cd /opt/chatforge

# 2. Создать и заполнить .env.prod
cp .env.prod.example .env.prod
nano .env.prod

# 3. Сгенерировать секреты
openssl rand -base64 64  # → SECRET_KEY_BASE
openssl rand -base64 64  # → GUARDIAN_SECRET_KEY

# 4. Запустить
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

При старте backend автоматически прогоняет миграции и создаёт super_admin из `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (если не заданы — `admin@chatforge.dev` / `Admin1234!`).

### DNS

Направить на IP сервера:
- `yourdomain.com` → фронтенд + API
- `minio.yourdomain.com` → MinIO S3
- `minio-console.yourdomain.com` → MinIO консоль
- `traefik.yourdomain.com` → Traefik dashboard

TLS-сертификаты выпускаются автоматически через Let's Encrypt.

---

## Структура проекта

```
backend/                    ← Elixir/Phoenix бэкенд
  lib/chatforge/
    accounts/               ← Регистрация, аутентификация Creator-ов
    instances/              ← Chat Instance, визард, настройки
    chat/                   ← Диалоги, сообщения, End Users
    billing/                ← Подписки, тарифы, paywall
    ai/                     ← AI Orchestrator, streaming
    analytics/              ← События, метрики
    admin/                  ← Super Admin

frontend/                   ← React/TypeScript SPA
  src/
    pages/
      platform/             ← Страницы Creator-а (визард, дашборд)
      chat/                 ← Страницы End User-а (диалоги, подписки)
    features/               ← Бизнес-логика по фичам
    shared/                 ← UI-компоненты, утилиты
```

---

## Документация

| Документ | Описание |
|----------|----------|
| [BUSINESS_SPEC](sources-of-truth/BUSINESS_SPEC.md) | Бизнес-требования, роли, сценарии |
| [TECH_SPEC](sources-of-truth/TECH_SPEC.md) | Технический стек, структура, ограничения |
| [ARCHITECTURE](sources-of-truth/ARCHITECTURE.md) | Контексты, схема БД, потоки данных |
| [Фазы разработки](phases/README.md) | Дорожная карта по фазам |

---

## Фазы разработки

| Фаза | Название | Статус |
|------|----------|--------|
| 1 | Инфраструктура, БД, скелет | ✅ Завершена |
| 2 | Аутентификация | ✅ Завершена |
| 3 | Визард создания чата | ✅ Завершена |
| 4 | AI-чат (диалоги, streaming) | ✅ Завершена |
| 5 | Подписки и монетизация | ✅ Завершена |
| 6 | Дашборд и аналитика | ✅ Завершена |
| 7 | Admin-панель | ✅ Завершена |

---

## Лицензия

Проприетарный. Все права защищены.
