# Требования — ChatForge Phase 5: Подписки и монетизация

## Введение

Phase 5 реализует систему монетизации платформы ChatForge. Creator создаёт тарифные планы для своего чат-инстанса. End User видит paywall при исчерпании бесплатного лимита сообщений и оформляет подписку через фейковую платёжную систему. После оформления подписки лимиты пересчитываются с учётом тарифного плана.

Фаза включает: Billing bounded context (Ecto-схемы, бизнес-логика планов и подписок, Oban job для истечения), фейковый платёжный адаптер `Billing.FakePayment`, API для Creator-а (управление планами) и End User-а (просмотр планов, оформление подписки), расширение `Chat.check_limit/2` с учётом активной подписки, React-фронтенд (управление планами в дашборде, компонент Paywall, страницы success/cancel, статус подписки в профиле).

Фаза не включает: реальную интеграцию со Stripe или ЮKassa, реферальную программу, промокоды и скидки, возвраты через UI.

---

## Глоссарий

- **System** — платформа ChatForge в целом.
- **Billing_Context** — Elixir bounded context `ChatForge.Billing`, владеющий тарифными планами, подписками и платёжной логикой.
- **SubscriptionPlan** — Ecto-схема `ChatForge.Billing.SubscriptionPlan`, тарифный план, созданный Creator-ом для своего инстанса.
- **Subscription** — Ecto-схема `ChatForge.Billing.Subscription`, активная или истёкшая подписка End User-а на тарифный план.
- **FakePayment** — модуль `ChatForge.Billing.FakePayment`, фейковый платёжный адаптер, всегда возвращающий успешный результат без реальной интеграции.
- **ExpireSubscriptionsJob** — Oban job `ChatForge.Billing.ExpireSubscriptionsJob`, ежедневно деактивирующий истёкшие подписки.
- **Chat_Context** — Elixir bounded context `ChatForge.Chat`, расширяемый в этой фазе для учёта активной подписки при проверке лимитов.
- **Creator** — пользователь платформы (роль `creator`), создающий и управляющий чат-инстансом и тарифными планами.
- **EndUser** — конечный пользователь чат-инстанса, оформляющий подписку.
- **Dashboard_API** — Phoenix-контроллер, обслуживающий эндпоинты `/api/v1/dashboard/plans` для Creator-а.
- **Chat_Billing_API** — Phoenix-контроллер, обслуживающий эндпоинты `/api/v1/chat/plans` и `/api/v1/chat/subscriptions` для End User-а.
- **Paywall** — React-компонент, отображаемый End User-у при исчерпании лимита сообщений.
- **PubSub** — Phoenix.PubSub, шина событий платформы.
- **tenant_id** — идентификатор тенанта, равный `chat_instance_id`, присутствующий во всех таблицах Billing контекста.
- **Billing_Store** — Zustand-стор фронтенда для данных биллинга (планы, текущая подписка).
- **Dashboard_Plans_Page** — страница управления тарифными планами в дашборде Creator-а.
- **Subscription_Success_Page** — страница `/chat/subscription/success`, отображаемая после успешной оплаты.
- **Subscription_Cancel_Page** — страница `/chat/subscription/cancel`, отображаемая при отмене оплаты.

---

## Требования

### Требование 1: Billing контекст — Ecto-схемы

**User Story:** Как разработчик, я хочу иметь Ecto-схемы и changesets для тарифных планов и подписок, чтобы безопасно создавать и валидировать данные биллинга.

#### Критерии приёмки

1. THE Billing_Context SHALL содержать схему `ChatForge.Billing.SubscriptionPlan`, отображающую таблицу `subscription_plans` с полями: `id`, `chat_instance_id`, `name`, `price`, `period`, `message_limit`, `is_active`, `inserted_at`, `updated_at`.
2. THE Billing_Context SHALL содержать схему `ChatForge.Billing.Subscription`, отображающую таблицу `subscriptions` с полями: `id`, `chat_instance_id`, `end_user_id`, `plan_id`, `status`, `starts_at`, `expires_at`, `inserted_at`, `updated_at`.
3. THE Billing_Context SHALL содержать changeset для `SubscriptionPlan`, валидирующий: обязательность полей `chat_instance_id`, `name`, `price`, `period`; допустимые значения `period` — только `monthly` и `yearly`; значение `price` строго больше нуля; максимальную длину `name` 255 символов.
4. THE Billing_Context SHALL содержать changeset для `Subscription`, валидирующий: обязательность полей `chat_instance_id`, `end_user_id`, `plan_id`, `status`, `starts_at`, `expires_at`; допустимые значения `status` — только `active`, `expired`, `cancelled`.
5. WHEN changeset `SubscriptionPlan` вызывается с `price` равным нулю или отрицательным, THE Billing_Context SHALL вернуть changeset с ошибкой валидации на поле `price`.
6. WHEN changeset `SubscriptionPlan` вызывается с `period` отличным от `monthly` или `yearly`, THE Billing_Context SHALL вернуть changeset с ошибкой валидации на поле `period`.
7. WHEN changeset `Subscription` вызывается с `status` отличным от `active`, `expired` или `cancelled`, THE Billing_Context SHALL вернуть changeset с ошибкой валидации на поле `status`.
8. THE Billing_Context SHALL обеспечить, что поле `message_limit` в `SubscriptionPlan` допускает значение `nil` (безлимитный доступ).

---

### Требование 2: Billing контекст — бизнес-логика тарифных планов

**User Story:** Как Creator, я хочу создавать, редактировать и деактивировать тарифные планы для своего чата, чтобы монетизировать доступ к AI-ассистенту.

#### Критерии приёмки

1. WHEN `Billing.create_plan/2` вызывается с валидными атрибутами и `tenant_id`, THE Billing_Context SHALL создать `SubscriptionPlan` с `is_active: true` и вернуть `{:ok, plan}`.
2. IF `Billing.create_plan/2` вызывается с `price` равным нулю или отрицательным, THEN THE Billing_Context SHALL вернуть `{:error, changeset}` с ошибкой на поле `price`.
3. WHEN `Billing.list_plans/1` вызывается с `tenant_id`, THE Billing_Context SHALL вернуть список всех `SubscriptionPlan` данного тенанта, отсортированных по `inserted_at` по возрастанию.
4. WHEN `Billing.update_plan/2` вызывается с `plan_id` и валидными атрибутами, THE Billing_Context SHALL обновить план и вернуть `{:ok, updated_plan}`.
5. IF `Billing.update_plan/2` вызывается с `plan_id`, не принадлежащим данному тенанту, THEN THE Billing_Context SHALL вернуть `{:error, :not_found}`.
6. WHEN `Billing.deactivate_plan/1` вызывается с `plan_id`, THE Billing_Context SHALL установить `is_active: false` и вернуть `{:ok, plan}`, не удаляя запись из БД.
7. IF `Billing.deactivate_plan/1` вызывается с `plan_id`, не существующим в БД, THEN THE Billing_Context SHALL вернуть `{:error, :not_found}`.
8. THE Billing_Context SHALL обеспечить, что все запросы к таблице `subscription_plans` фильтруются по `chat_instance_id`.

---

### Требование 3: Billing контекст — бизнес-логика подписок

**User Story:** Как End User, я хочу оформить подписку на тарифный план, чтобы получить расширенный доступ к AI-чату.

#### Критерии приёмки

1. WHEN `Billing.create_subscription/3` вызывается с `end_user_id`, `plan_id` и `tenant_id`, THE Billing_Context SHALL создать `Subscription` со статусом `active`, вычислить `expires_at` на основе `period` плана (monthly: +30 дней, yearly: +365 дней) и вернуть `{:ok, subscription}`.
2. WHEN `Billing.create_subscription/3` успешно создаёт подписку, THE Billing_Context SHALL опубликовать событие `subscription.created` через PubSub с данными `%{subscription_id: id, end_user_id: end_user_id, tenant_id: tenant_id}`.
3. WHEN `Billing.get_active_subscription/2` вызывается с `end_user_id` и `tenant_id`, THE Billing_Context SHALL вернуть `{:ok, subscription}` с предзагруженным `plan`, если существует подписка со статусом `active` и `expires_at` в будущем.
4. IF активная подписка не найдена, THEN `Billing.get_active_subscription/2` SHALL вернуть `{:ok, nil}`.
5. WHEN `Billing.expire_subscriptions/0` вызывается (Oban job), THE Billing_Context SHALL обновить статус на `expired` для всех `Subscription`, где `status == active` и `expires_at < NOW()`, и вернуть количество обновлённых записей.
6. WHEN `ExpireSubscriptionsJob` деактивирует подписку, THE Billing_Context SHALL опубликовать событие `subscription.expired` через PubSub для каждой истёкшей подписки с данными `%{subscription_id: id, end_user_id: end_user_id, tenant_id: tenant_id}`.
7. THE Billing_Context SHALL обеспечить, что все запросы к таблице `subscriptions` фильтруются по `chat_instance_id`.
8. THE Billing_Context SHALL обеспечить, что `ExpireSubscriptionsJob` запускается по расписанию Oban один раз в сутки.

---

### Требование 4: Billing — фейковая платёжная система

**User Story:** Как разработчик, я хочу иметь фейковый платёжный адаптер, чтобы реализовать полный flow подписки без реальной интеграции с платёжными системами.

#### Критерии приёмки

1. THE Billing_Context SHALL содержать модуль `ChatForge.Billing.FakePayment` с функцией `create_checkout_session/2`.
2. WHEN `FakePayment.create_checkout_session/2` вызывается с `plan_id` и `end_user_id`, THE FakePayment SHALL всегда возвращать `{:ok, url}`, где `url` — строка вида `/chat/subscription/success?plan_id=<plan_id>&user_id=<end_user_id>`.
3. THE System SHALL содержать webhook-эндпоинт `POST /api/v1/webhooks/payment`, принимающий `plan_id` и `end_user_id` в теле запроса.
4. WHEN `POST /api/v1/webhooks/payment` получает запрос с валидными `plan_id` и `end_user_id`, THE System SHALL вызвать `Billing.create_subscription/3` и вернуть HTTP 200.
5. THE System SHALL не выполнять верификацию подписи webhook (фейковая реализация).
6. IF `POST /api/v1/webhooks/payment` получает запрос с отсутствующим `plan_id` или `end_user_id`, THEN THE System SHALL вернуть HTTP 422.

---

### Требование 5: Billing — API Creator-а (управление планами)

**User Story:** Как Creator, я хочу иметь REST API для управления тарифными планами своего чата, чтобы создавать, редактировать и деактивировать планы из дашборда.

#### Критерии приёмки

1. WHEN `GET /api/v1/dashboard/plans` получает запрос от аутентифицированного Creator-а, THE Dashboard_API SHALL вернуть HTTP 200 со списком всех тарифных планов инстанса Creator-а.
2. WHEN `POST /api/v1/dashboard/plans` получает запрос с валидными данными плана, THE Dashboard_API SHALL создать план и вернуть HTTP 201 с данными созданного `SubscriptionPlan`.
3. IF `POST /api/v1/dashboard/plans` получает запрос с невалидными данными (например, `price <= 0`), THEN THE Dashboard_API SHALL вернуть HTTP 422 с описанием ошибок валидации.
4. WHEN `PUT /api/v1/dashboard/plans/:id` получает запрос с валидными данными, THE Dashboard_API SHALL обновить план и вернуть HTTP 200 с обновлёнными данными.
5. IF `PUT /api/v1/dashboard/plans/:id` вызывается для плана, не принадлежащего инстансу Creator-а, THEN THE Dashboard_API SHALL вернуть HTTP 404.
6. WHEN `DELETE /api/v1/dashboard/plans/:id` получает запрос, THE Dashboard_API SHALL деактивировать план (установить `is_active: false`) и вернуть HTTP 200.
7. IF `DELETE /api/v1/dashboard/plans/:id` вызывается для несуществующего плана, THEN THE Dashboard_API SHALL вернуть HTTP 404.
8. THE Dashboard_API SHALL требовать аутентификации Creator-а для всех эндпоинтов: запросы без валидного Bearer-токена SHALL получать HTTP 401.

---

### Требование 6: Billing — API End User-а (планы и подписки)

**User Story:** Как End User, я хочу видеть доступные тарифные планы и оформить подписку, чтобы получить расширенный доступ к AI-чату после исчерпания бесплатного лимита.

#### Критерии приёмки

1. WHEN `GET /api/v1/chat/plans` получает запрос в контексте тенанта, THE Chat_Billing_API SHALL вернуть HTTP 200 со списком активных (`is_active: true`) тарифных планов инстанса.
2. THE Chat_Billing_API SHALL не требовать аутентификации для `GET /api/v1/chat/plans`: запросы без токена SHALL получать те же данные.
3. WHEN `POST /api/v1/chat/subscriptions` получает запрос от аутентифицированного End User-а с `plan_id`, THE Chat_Billing_API SHALL вызвать `FakePayment.create_checkout_session/2` и вернуть HTTP 200 с `%{checkout_url: url}`.
4. IF `POST /api/v1/chat/subscriptions` получает запрос с `plan_id`, не принадлежащим данному тенанту или неактивным, THEN THE Chat_Billing_API SHALL вернуть HTTP 404.
5. WHEN `GET /api/v1/chat/subscriptions/current` получает запрос от аутентифицированного End User-а, THE Chat_Billing_API SHALL вернуть HTTP 200 с данными активной подписки и предзагруженным планом, или `%{subscription: null}` если подписки нет.
6. THE Chat_Billing_API SHALL требовать аутентификации End User-а для `POST /api/v1/chat/subscriptions` и `GET /api/v1/chat/subscriptions/current`: запросы без токена SHALL получать HTTP 401.
7. THE Chat_Billing_API SHALL обеспечить tenant-изоляцию: End User одного тенанта не может получить доступ к данным другого тенанта.

---

### Требование 7: Chat контекст — расширение логики лимитов

**User Story:** Как End User с активной подпиской, я хочу, чтобы система учитывала лимит моего тарифного плана вместо бесплатного лимита, чтобы я мог отправлять больше сообщений.

#### Критерии приёмки

1. WHEN `Chat.check_limit/2` вызывается с `end_user_id` и `tenant_id`, THE Chat_Context SHALL сначала проверить наличие активной подписки через `Billing.get_active_subscription/2`.
2. WHILE у End User-а есть активная подписка с `message_limit: nil`, THE Chat_Context SHALL вернуть `{:ok, :allowed}` без проверки счётчика сообщений (безлимитный доступ).
3. WHILE у End User-а есть активная подписка с числовым `message_limit`, THE Chat_Context SHALL сравнить `EndUser.messages_used` с `message_limit` плана и вернуть `{:ok, :allowed}` или `{:error, :limit_reached}`.
4. WHEN у End User-а нет активной подписки, THE Chat_Context SHALL применить прежнюю логику: сравнить `EndUser.messages_used` с бесплатным лимитом из настроек инстанса.
5. IF `Chat.check_limit/2` возвращает `{:error, :limit_reached}`, THEN THE Chat_Context SHALL опубликовать событие `limit.reached` через PubSub с данными `%{end_user_id: id, tenant_id: tenant_id}`.

---

### Требование 8: Frontend — управление планами в дашборде Creator-а

**User Story:** Как Creator, я хочу управлять тарифными планами своего чата из дашборда, чтобы настраивать монетизацию без обращения к API напрямую.

#### Критерии приёмки

1. THE Dashboard_Plans_Page SHALL загружать список тарифных планов через `GET /api/v1/dashboard/plans` при монтировании.
2. WHEN список планов загружен и не пуст, THE Dashboard_Plans_Page SHALL отображать каждый план с: названием, ценой, периодом, лимитом сообщений (или "Безлимит"), статусом активности.
3. WHEN список планов пуст, THE Dashboard_Plans_Page SHALL отображать пустое состояние с текстом "Создайте первый тарифный план".
4. THE Dashboard_Plans_Page SHALL содержать форму создания плана с полями: название (обязательное), цена (обязательное, > 0), период (`monthly` | `yearly`), лимит сообщений (необязательное, пустое = безлимит).
5. WHEN Creator заполняет форму и нажимает "Создать", THE Dashboard_Plans_Page SHALL вызвать `POST /api/v1/dashboard/plans` и при успехе обновить список планов.
6. WHEN Creator нажимает "Редактировать" у плана, THE Dashboard_Plans_Page SHALL отобразить форму редактирования с предзаполненными данными и при сохранении вызвать `PUT /api/v1/dashboard/plans/:id`.
7. WHEN Creator нажимает "Деактивировать" у плана, THE Dashboard_Plans_Page SHALL запросить подтверждение, затем вызвать `DELETE /api/v1/dashboard/plans/:id` и обновить список.
8. IF запрос к API завершается ошибкой, THEN THE Dashboard_Plans_Page SHALL отобразить toast-уведомление с описанием ошибки через Sonner.
9. WHILE данные загружаются, THE Dashboard_Plans_Page SHALL отображать skeleton-загрузчик.

---

### Требование 9: Frontend — компонент Paywall

**User Story:** Как End User, я хочу видеть модальное окно с тарифными планами при исчерпании лимита сообщений, чтобы легко оформить подписку и продолжить общение с AI.

#### Критерии приёмки

1. WHEN в ChatChannel приходит событие `limit_reached`, THE Paywall SHALL отобразиться как модальное окно поверх интерфейса диалога.
2. WHEN Paywall открывается, THE Paywall SHALL загрузить список активных планов через `GET /api/v1/chat/plans` и отобразить каждый план с: названием, ценой, периодом, лимитом сообщений (или "Безлимит").
3. WHEN End User нажимает "Оформить подписку" у плана, THE Paywall SHALL вызвать `POST /api/v1/chat/subscriptions` с `plan_id` и перенаправить браузер на полученный `checkout_url`.
4. THE Paywall SHALL блокировать поле ввода сообщений, пока открыто.
5. WHILE планы загружаются в Paywall, THE Paywall SHALL отображать skeleton-загрузчик.
6. IF запрос к `GET /api/v1/chat/plans` завершается ошибкой, THEN THE Paywall SHALL отобразить сообщение об ошибке внутри модального окна.

---

### Требование 10: Frontend — страницы результата оплаты

**User Story:** Как End User, я хочу видеть понятные страницы после успешной или отменённой оплаты, чтобы знать результат и вернуться в чат.

#### Критерии приёмки

1. THE System SHALL содержать страницу `/chat/subscription/success`, отображаемую после успешного оформления подписки.
2. WHEN Subscription_Success_Page монтируется, THE System SHALL прочитать `plan_id` и `user_id` из query-параметров URL и вызвать `POST /api/v1/webhooks/payment` для создания подписки.
3. WHEN webhook-запрос завершается успешно, THE Subscription_Success_Page SHALL отобразить сообщение об успешной подписке и кнопку "Вернуться в чат".
4. IF webhook-запрос завершается ошибкой, THEN THE Subscription_Success_Page SHALL отобразить сообщение об ошибке и кнопку "Попробовать снова".
5. THE System SHALL содержать страницу `/chat/subscription/cancel`, отображаемую при отмене оплаты.
6. WHEN Subscription_Cancel_Page монтируется, THE Subscription_Cancel_Page SHALL отобразить сообщение об отмене оплаты и кнопку "Вернуться в чат".

---

### Требование 11: Frontend — статус подписки End User-а

**User Story:** Как End User, я хочу видеть информацию о своей текущей подписке в интерфейсе чата, чтобы знать свой тарифный план и оставшийся лимит сообщений.

#### Критерии приёмки

1. WHEN ConversationPage монтируется, THE System SHALL загрузить текущую подписку End User-а через `GET /api/v1/chat/subscriptions/current`.
2. WHEN активная подписка найдена, THE System SHALL отобразить в сайдбаре ConversationPage: название тарифного плана, дату истечения подписки, оставшийся лимит сообщений (если `message_limit` не `nil`).
3. WHEN активная подписка не найдена, THE System SHALL отобразить в сайдбаре: текущее количество использованных сообщений из бесплатного лимита.
4. WHILE данные подписки загружаются, THE System SHALL отображать skeleton-загрузчик в области статуса подписки.

---

## Свойства корректности (Correctness Properties)

### CP-1: Инвариант tenant-изоляции планов

Для любых двух тенантов `A` и `B` (`A ≠ B`): `Billing.list_plans(A)` никогда не должен содержать планы, где `chat_instance_id == B`.

### CP-2: Round-trip — создание и получение плана

Для любых валидных атрибутов и `tenant_id`: если `Billing.create_plan/2` вернул `{:ok, plan}`, то `Billing.list_plans(tenant_id)` должен содержать план с тем же `id` и `chat_instance_id`.

### CP-3: Инвариант деактивации плана

Для любого `plan_id`: после успешного вызова `Billing.deactivate_plan/1` запись в БД должна существовать с `is_active: false`. Повторный вызов `Billing.deactivate_plan/1` для того же `plan_id` должен возвращать `{:ok, plan}` (идемпотентность).

### CP-4: Round-trip — создание и получение подписки

Для любых валидных `end_user_id`, `plan_id`, `tenant_id`: если `Billing.create_subscription/3` вернул `{:ok, sub}`, то `Billing.get_active_subscription(end_user_id, tenant_id)` должен вернуть `{:ok, subscription}` с тем же `id`.

### CP-5: Инвариант истечения подписки

Для любой `Subscription` со статусом `active` и `expires_at < NOW()`: после вызова `Billing.expire_subscriptions/0` статус этой подписки должен быть `expired`.

### CP-6: Инвариант валидации цены плана

Для любого числового значения `price <= 0`: changeset `SubscriptionPlan` должен быть невалидным с ошибкой на поле `price`.

### CP-7: Инвариант безлимитного доступа

Для любого `end_user_id` с активной подпиской, где `message_limit: nil`: `Chat.check_limit/2` должен всегда возвращать `{:ok, :allowed}` независимо от значения `EndUser.messages_used`.

### CP-8: Инвариант приоритета подписки над бесплатным лимитом

Для любого `end_user_id` с активной подпиской: `Chat.check_limit/2` должен использовать `message_limit` плана, а не бесплатный лимит инстанса. То есть если `EndUser.messages_used > free_limit` но `EndUser.messages_used < plan.message_limit`, результат должен быть `{:ok, :allowed}`.
