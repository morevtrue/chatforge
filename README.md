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
| Файлы      | S3-совместимое (MinIO для dev)            |
| Real-time  | Phoenix Channels (WebSocket)              |
| Edge       | Traefik 3+                                |
| CI/CD      | GitHub Actions                            |

---

## Быстрый старт

### Требования

- Docker + Docker Compose
- Elixir 1.17+ / Erlang 26+
- Node.js 20+ / npm

### Запуск

```bash
# 1. Поднять инфраструктуру
docker-compose up -d

# 2. Настроить бэкенд
cd chatforge
mix deps.get
mix ecto.setup
mix phx.server

# 3. Настроить фронтенд (в отдельном терминале)
cd frontend
npm install
npm run dev
```

Бэкенд: `http://localhost:4000`
Фронтенд: `http://localhost:5173`
Health-check: `GET http://localhost:4000/health`

---

## Структура проекта

```
chatforge/                  ← Elixir/Phoenix бэкенд
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
| 1 | Инфраструктура, БД, скелет | 🔄 Активная |
| 2 | Аутентификация | 🔜 Следующая |
| 3 | Визард создания чата | ⏸️ Планируется |
| 4 | AI-чат (диалоги, streaming) | ⏸️ Планируется |
| 5 | Подписки и монетизация | ⏸️ Планируется |
| 6 | Дашборд и аналитика | ⏸️ Планируется |
| 7 | Admin-панель | ⏸️ Планируется |

---

## Работа с AI-агентом

Проект настроен для работы с AI-агентом в IDE (Kiro). Система включает:
- Ролевые агенты: Backend, Frontend, QA, Product (`agents/`).
- Хуки для автоматических проверок (`hooks/`).
- Фазовую документацию для пошаговой разработки (`phases/`).
- Правила и ограничения (`rules.md`).

Подробнее: [`agents/`](agents/), [`hooks/HOOKS_GUIDE.md`](hooks/HOOKS_GUIDE.md).

---

## Лицензия

Проприетарный. Все права защищены.
