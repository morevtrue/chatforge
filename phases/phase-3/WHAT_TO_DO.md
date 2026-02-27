# Phase 3 — Визард создания чата (Builder)

**Название фазы:** Builder Wizard — пошаговое создание Chat Instance
**Статус:** ✅ Завершена

---

## Цель фазы

Creator проходит 4-шаговый визард и получает готовый Chat Instance с поддоменом.
После этой фазы — чат создан, доступен по URL, настройки сохранены.

---

## Задачи

### 3.1 Instances — Ecto-схемы
- [ ] Схема `ChatForge.Instances.ChatInstance` (поля из миграции)
- [ ] Схема `ChatForge.Instances.InstanceSettings`
- [ ] Схема `ChatForge.Instances.WizardState` (хранит прогресс визарда: текущий шаг, черновик настроек)
- [ ] Changeset для каждой схемы с валидацией

### 3.2 Instances — бизнес-логика
- [ ] `Instances.create_instance/2` — создать ChatInstance для creator_id
- [ ] `Instances.get_instance_by_subdomain/1` — найти по поддомену (используется TenantResolver)
- [ ] `Instances.get_instance_by_creator/1` — найти инстанс Creator-а
- [ ] `Instances.update_settings/2` — обновить настройки инстанса
- [ ] `Instances.validate_subdomain/1` — проверить уникальность и формат поддомена (только a-z, 0-9, дефис)
- [ ] `Instances.finalize_wizard/1` — перевести статус из `draft` в `active`
- [ ] Публикация события `instance.created` через PubSub при финализации

### 3.3 Instances — загрузка файлов (аватар)
- [ ] Настроить `ex_aws` для работы с MinIO (dev) и S3 (prod)
- [ ] Функция `Instances.upload_avatar/2` — загрузить файл в S3, вернуть URL
- [ ] Валидация: только изображения (jpg, png, webp), максимум 5 МБ

### 3.4 Instances — API контроллер (визард)
- [ ] `POST /api/v1/builder/start` — начать визард, создать WizardState
- [ ] `PUT /api/v1/builder/step/1` — сохранить цветовую схему (`primary_color`, `secondary_color`, `background_color`)
- [ ] `PUT /api/v1/builder/step/2` — сохранить название и валюту (валидация поддомена)
- [ ] `PUT /api/v1/builder/step/3` — сохранить приветствие, примеры вопросов; `POST /api/v1/builder/avatar` — загрузить аватар
- [ ] `PUT /api/v1/builder/step/4` — сохранить лимит бесплатных сообщений
- [ ] `POST /api/v1/builder/finalize` — финализировать, создать ChatInstance со статусом `active`
- [ ] `GET /api/v1/builder/state` — получить текущий прогресс визарда
- [ ] Все эндпоинты требуют аутентификации Creator-а

### 3.5 Instances — API контроллер (управление)
- [ ] `GET /api/v1/dashboard/instance` — получить инстанс текущего Creator-а
- [ ] `PUT /api/v1/dashboard/instance/settings` — обновить настройки после создания
- [ ] `POST /api/v1/dashboard/instance/avatar` — обновить аватар

### 3.6 Frontend — визард (платформа)
- [ ] Страница `/builder` — контейнер визарда с прогресс-баром (шаги 1–4)
- [ ] Шаг 1: палитра цветов (готовые варианты + color picker), превью в реальном времени
- [ ] Шаг 2: поле ввода названия (= поддомен), выбор валюты (select), проверка доступности поддомена (debounce)
- [ ] Шаг 3: загрузка аватара (drag & drop + preview), textarea для приветствия, добавление примеров вопросов
- [ ] Шаг 4: поле лимита бесплатных сообщений (число или "без лимита")
- [ ] Кнопка "Назад" на каждом шаге — возврат без потери данных
- [ ] Финальный экран: "Ваш чат создан!" + ссылка на чат
- [ ] Состояние визарда в Zustand store (`src/features/builder/store.ts`)

### 3.7 Frontend — дашборд Creator-а (базовый)
- [ ] Страница `/dashboard` — отображение информации о созданном чате
- [ ] Блок настроек: кнопки перехода к редактированию цветов, аватара, приветствия
- [ ] Ссылка на публичный URL чата

---

## Ограничения

- НЕ входит: подписки и тарифные планы (Phase 5).
- НЕ входит: аналитика (Phase 6).
- НЕ входит: AI-интеграция (Phase 4).

---

## Ссылки

- Архитектура: `sources-of-truth/ARCHITECTURE.md`
- Бизнес-логика: `sources-of-truth/BUSINESS_SPEC.md`
