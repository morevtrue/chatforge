# Phase 3 — Тесты и проверки

**Статус:** ✅ Компиляция проверена

---

## Подготовка

1. Phase 1 и Phase 2 завершены.
2. PostgreSQL запущен на порту 5433, пользователь/пароль: `chatforge`.
3. Redis запущен на порту 6379.
4. MinIO или S3 настроен через env-переменные.
5. `GUARDIAN_SECRET_KEY` задан в `.env`.

---

## Чеклист

### Компиляция
- [x] `compile_check.bat` проходит без ошибок (backend)
- [x] TypeScript-диагностика чистая (frontend, все новые файлы)

### Backend — Instances (бизнес-логика)
- [ ] `create_instance/2` с валидными данными → `{:ok, instance}` со статусом `draft`
- [ ] `create_instance/2` с дублирующимся поддоменом → `{:error, changeset}`
- [ ] `get_instance_by_subdomain/1` с существующим поддоменом → `{:ok, instance}`
- [ ] `get_instance_by_subdomain/1` с несуществующим → `{:error, :not_found}`
- [ ] `validate_subdomain/1` с символами вне `[a-z0-9-]` → `{:error, :invalid_format}`
- [ ] `validate_subdomain/1` с занятым поддоменом → `{:error, :taken}`
- [ ] `validate_subdomain/1` со свободным поддоменом → `{:ok, :available}`
- [ ] `finalize_wizard/1` с полным WizardState → `{:ok, instance}` со статусом `active`, WizardState удалён
- [ ] `finalize_wizard/1` с неполным WizardState → `{:error, :incomplete_wizard}`
- [ ] `upload_avatar/2` с недопустимым MIME → `{:error, :invalid_file_type}`
- [ ] `upload_avatar/2` с файлом > 5 МБ → `{:error, :file_too_large}`

### Backend — BuilderController
- [ ] `POST /api/v1/builder/start` без токена → 401
- [ ] `POST /api/v1/builder/start` первый вызов → 201
- [ ] `POST /api/v1/builder/start` повторный вызов → 200 (идемпотентность)
- [ ] `GET /api/v1/builder/state` → 200 с wizard_state
- [ ] `PUT /api/v1/builder/step/1` с валидными цветами → 200
- [ ] `PUT /api/v1/builder/step/1` с невалидным цветом → 422
- [ ] `GET /api/v1/builder/validate-subdomain?subdomain=test` → 200
- [ ] `POST /api/v1/builder/finalize` с полным WizardState → 201 с chat_instance
- [ ] `POST /api/v1/builder/finalize` с неполным WizardState → 422

### Backend — DashboardController
- [ ] `GET /api/v1/dashboard/instance` без токена → 401
- [ ] `GET /api/v1/dashboard/instance` с инстансом → 200
- [ ] `GET /api/v1/dashboard/instance` без инстанса → 404
- [ ] `PUT /api/v1/dashboard/instance/settings` с валидными данными → 200
- [ ] `PUT /api/v1/dashboard/instance/settings` с невалидным цветом → 422
- [ ] Попытка доступа к чужому инстансу → 403

### Frontend — визард `/builder`
- [ ] Страница загружается, прогресс-бар отображает шаг 1
- [ ] Шаг 1: выбор готовой схемы обновляет превью в реальном времени
- [ ] Шаг 1: ручной color picker обновляет превью
- [ ] Шаг 1: кнопка "Далее" вызывает `PUT /api/v1/builder/step/1`
- [ ] Шаг 2: ввод названия генерирует поддомен автоматически
- [ ] Шаг 2: debounce 500мс — проверка поддомена не вызывается при каждом символе
- [ ] Шаг 2: занятый поддомен → сообщение "Поддомен уже занят"
- [ ] Шаг 2: невалидный формат → сообщение об ошибке
- [ ] Шаг 2: кнопка "Далее" заблокирована пока поддомен не проверен
- [ ] Шаг 3: drag & drop файла → превью аватара
- [ ] Шаг 3: файл > 5 МБ → сообщение об ошибке без загрузки
- [ ] Шаг 3: недопустимый формат → сообщение об ошибке
- [ ] Шаг 4: чекбокс "без лимита" скрывает числовое поле
- [ ] Шаг 4: кнопка "Создать чат" вызывает `POST /api/v1/builder/finalize`
- [ ] После финализации → финальный экран с публичным URL
- [ ] Кнопка "Назад" на каждом шаге возвращает без потери данных
- [ ] Неавторизованный пользователь → редирект на `/login`

### Frontend — дашборд `/dashboard`
- [ ] Страница загружает данные инстанса при монтировании
- [ ] InstanceCard отображает название, поддомен, статус, публичный URL
- [ ] Публичный URL — кликабельная ссылка, открывается в новой вкладке
- [ ] SettingsPanel: изменение цвета → сохранение через `PUT /api/v1/dashboard/instance/settings`
- [ ] SettingsPanel: загрузка аватара → обновление через `POST /api/v1/dashboard/instance/avatar`
- [ ] Creator без инстанса → редирект на `/builder`
- [ ] Неавторизованный пользователь → редирект на `/login`

### Изоляция данных
- [ ] Creator A не видит инстанс Creator B
- [ ] `GET /api/v1/dashboard/instance` возвращает только инстанс текущего Creator-а

---

## Результаты

- Компиляция backend: ✅ `compile_check.bat` чистый
- TypeScript-диагностика frontend: ✅ все файлы без ошибок
- QA-проверка кода: ✅ проведена, все критичные и важные баги исправлены
- Product-проверка: ✅ все требования 1–7 реализованы, расхождения устранены
- Ручное тестирование API: требует запущенного окружения (`docker-compose up`)
- Ручное тестирование UI: требует запущенного dev-сервера (`npm run dev`)

### Исправленные баги
- ✅ Двойная финализация (`BuilderPage` + `Step4Limit`)
- ✅ `String.to_integer` без защиты → `Integer.parse` с guard
- ✅ Прямой `Repo` в `BuilderController` → `Instances.get_wizard_state/1`
- ✅ `current_step` не инкрементировался → `step + 1` в `update_wizard_step/3`
- ✅ `SettingsPanel` получал `undefined` → контроллер возвращает `{chat_instance: ...}`
- ✅ Требование 6.11: редирект `/builder` → `/dashboard` при наличии инстанса
