# Phase 7 — TESTS

## Чеклист проверок Admin-панели

---

### Backend

#### Миграция и схема
- [ ] Миграция `add_status_to_users` применяется без ошибок (`mix ecto.migrate`)
- [ ] Колонка `status` присутствует в таблице `users` с дефолтом `'active'`
- [ ] `User` schema корректно кастит и валидирует поле `status` (только `active`/`suspended`)

#### Аутентификация
- [ ] `Accounts.authenticate/2` возвращает `{:error, :suspended}` для пользователя со статусом `suspended`
- [ ] `Accounts.authenticate/2` возвращает `{:ok, user}` для активного пользователя

#### Admin контекст
- [ ] `Admin.list_creators/1` возвращает пагинированный список (20/стр)
- [ ] `Admin.list_creators/1` фильтрует по `search` (ilike по email)
- [ ] `Admin.list_creators/1` фильтрует по `status`
- [ ] `Admin.get_creator_with_instances/1` возвращает Creator + его инстансы
- [ ] `Admin.get_platform_stats/0` возвращает `total_creators`, `active_instances`, `total_messages`, `total_revenue`
- [ ] `Admin.suspend_creator/2` устанавливает `status = "suspended"` + suspend все инстансы
- [ ] `Admin.suspend_creator/2` запрещает self-suspend (возвращает ошибку)
- [ ] `Admin.activate_creator/2` устанавливает `status = "active"`
- [ ] `Admin.suspend_instance/2` устанавливает `status = "suspended"`
- [ ] `Admin.activate_instance/2` устанавливает `status = "active"`
- [ ] `Admin.get_ai_usage/1` возвращает агрегацию за 7d и 30d

#### Plug и роутер
- [ ] `RequireSuperAdmin` возвращает HTTP 403 для роли `creator`
- [ ] `RequireSuperAdmin` возвращает HTTP 403 для неаутентифицированного запроса
- [ ] `RequireSuperAdmin` пропускает запрос для роли `super_admin`
- [ ] Все 9 маршрутов `/api/v1/admin/*` доступны

#### AdminController
- [ ] `GET /api/v1/admin/stats` — возвращает JSON со статистикой
- [ ] `GET /api/v1/admin/creators` — возвращает пагинированный список
- [ ] `GET /api/v1/admin/creators?search=test` — фильтрует по email
- [ ] `GET /api/v1/admin/creators/:id` — возвращает детали Creator-а
- [ ] `PUT /api/v1/admin/creators/:id/suspend` — блокирует Creator-а
- [ ] `PUT /api/v1/admin/creators/:id/activate` — разблокирует Creator-а
- [ ] `GET /api/v1/admin/instances` — возвращает список инстансов
- [ ] `PUT /api/v1/admin/instances/:id/suspend` — приостанавливает инстанс
- [ ] `PUT /api/v1/admin/instances/:id/activate` — восстанавливает инстанс
- [ ] `GET /api/v1/admin/ai-usage?period=7d` — возвращает данные за 7 дней
- [ ] `GET /api/v1/admin/ai-usage?period=30d` — возвращает данные за 30 дней

---

### Frontend

#### AdminRoute guard
- [ ] Пользователь с ролью `creator` перенаправляется на `/dashboard` при попытке зайти на `/admin`
- [ ] Неаутентифицированный пользователь перенаправляется на `/login`
- [ ] Пользователь с ролью `super_admin` видит Admin-панель

#### AdminLayout
- [ ] Sidebar отображает 4 пункта: Обзор, Creator-ы, Инстансы, AI Usage
- [ ] Активный пункт меню подсвечивается
- [ ] Кнопка выхода работает корректно
- [ ] На мобильном устройстве отображается hamburger-меню

#### AdminOverviewPage (`/admin`)
- [ ] Отображаются 4 карточки: Creator-ы, Инстансы, Сообщения, Доход
- [ ] Во время загрузки отображается skeleton
- [ ] При ошибке отображается сообщение с кнопкой retry

#### AdminCreatorsPage (`/admin/creators`)
- [ ] Таблица отображает: email, имя, дата регистрации, статус, кол-во инстансов
- [ ] Поиск по email работает с debounce 300ms
- [ ] Фильтр по статусу (все / активные / заблокированные) работает
- [ ] Пагинация работает корректно
- [ ] Кнопка "Заблокировать" показывает диалог подтверждения
- [ ] После подтверждения статус Creator-а меняется в таблице
- [ ] Кнопка "Разблокировать" работает аналогично

#### AdminInstancesPage (`/admin/instances`)
- [ ] Таблица отображает: название, поддомен, Creator, статус, кол-во пользователей
- [ ] Фильтр по статусу работает
- [ ] Пагинация работает корректно
- [ ] Кнопки "Приостановить" / "Восстановить" работают с подтверждением

#### AdminAiUsagePage (`/admin/ai-usage`)
- [ ] Переключатель периода (7д / 30д) работает
- [ ] Карточки отображают: токены, стоимость, кол-во запросов
- [ ] Таблица по инстансам отображает разбивку использования

---

### Интеграционные проверки
- [ ] Заблокированный Creator не может войти в систему (получает ошибку)
- [ ] Приостановленный инстанс недоступен для пользователей
- [ ] Super Admin может управлять всеми Creator-ами и инстансами через UI
