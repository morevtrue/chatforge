# Phase 7 — Admin-панель платформы

**Название фазы:** Super Admin — управление платформой ChatForge
**Статус:** ✅ Завершена

---

## Цель фазы

Super Admin видит всю платформу: Creator-ы, инстансы, использование AI, может управлять доступом.
После этой фазы — платформа управляема без прямого доступа к БД.

---

## Задачи

### 7.1 Admin контекст — бизнес-логика
- [ ] `Admin.list_creators/1` — список всех Creator-ов (с пагинацией и поиском)
- [ ] `Admin.list_instances/1` — список всех Chat Instances (с фильтрами: статус, дата)
- [ ] `Admin.get_platform_stats/0` — сводная статистика платформы
- [ ] `Admin.suspend_instance/2` — приостановить инстанс (статус `suspended`)
- [ ] `Admin.activate_instance/2` — восстановить инстанс
- [ ] `Admin.suspend_creator/2` — заблокировать Creator-а
- [ ] `Admin.get_ai_usage/1` — использование AI API за период (токены, стоимость)

### 7.2 Admin — API контроллер
- [ ] Все эндпоинты требуют роль `super_admin`
- [ ] `GET /api/v1/admin/stats` — сводка платформы: Creator-ы, инстансы, сообщения, доход
- [ ] `GET /api/v1/admin/creators` — список Creator-ов (пагинация, поиск по email)
- [ ] `GET /api/v1/admin/creators/:id` — детали Creator-а + его инстансы
- [ ] `PUT /api/v1/admin/creators/:id/suspend` — заблокировать
- [ ] `PUT /api/v1/admin/creators/:id/activate` — разблокировать
- [ ] `GET /api/v1/admin/instances` — список всех инстансов
- [ ] `PUT /api/v1/admin/instances/:id/suspend` — приостановить инстанс
- [ ] `PUT /api/v1/admin/instances/:id/activate` — восстановить инстанс
- [ ] `GET /api/v1/admin/ai-usage?period=7d|30d` — использование AI API

### 7.3 Admin — Plug для защиты маршрутов
- [ ] Plug `ChatForgeWeb.Plugs.RequireSuperAdmin` — проверить роль `super_admin`
- [ ] Подключить в отдельный pipeline `:admin` в роутере
- [ ] Вернуть 403 для всех остальных ролей

### 7.4 Frontend — Admin SPA (отдельный раздел)
- [ ] Раздел `/admin` — доступен только для super_admin
- [ ] Страница `/admin` — сводная статистика платформы (карточки + графики)
- [ ] Страница `/admin/creators` — таблица Creator-ов (email, имя, дата регистрации, статус, кол-во инстансов)
- [ ] Поиск по email, фильтр по статусу
- [ ] Кнопки "Заблокировать" / "Разблокировать" с подтверждением
- [ ] Страница `/admin/instances` — таблица инстансов (название, поддомен, Creator, статус, пользователи)
- [ ] Кнопки "Приостановить" / "Восстановить"
- [ ] Страница `/admin/ai-usage` — использование AI API: токены, стоимость, разбивка по инстансам

### 7.5 Frontend — защита Admin-раздела
- [ ] HOC или route guard: редирект на `/` если роль не `super_admin`
- [ ] Отдельный layout для Admin (без sidebar Creator-а)

---

## Ограничения

- НЕ входит: создание Super Admin через UI (только через seed/миграцию).
- НЕ входит: управление конфигурацией платформы через UI.
- НЕ входит: просмотр содержимого диалогов пользователей.

---

## Ссылки

- Архитектура: `sources-of-truth/ARCHITECTURE.md`
- Бизнес-логика: `sources-of-truth/BUSINESS_SPEC.md`
