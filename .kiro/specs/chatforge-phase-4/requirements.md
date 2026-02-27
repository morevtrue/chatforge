# Требования — ChatForge Phase 4: AI-чат (диалоги, сообщения, streaming)

## Введение

Phase 4 реализует основной функционал платформы ChatForge — AI-чат для конечных пользователей. End User может создавать диалоги, отправлять сообщения и получать ответы от AI в режиме реального времени через streaming. История сообщений сохраняется, лимиты использования считаются.

Фаза включает: AI контекст (HTTP-клиент Req, OpenAI streaming, логирование использования), Chat контекст (Ecto-схемы Conversation и Message, бизнес-логика диалогов и сообщений, проверка лимитов), Phoenix Channel для streaming, REST API диалогов и публичного лендинга, React-фронтенд (лендинг чата, список диалогов, интерфейс диалога, WebSocket-хук).

Фаза не включает: подписки и paywall (Phase 5), поддержку нескольких AI-провайдеров (только OpenAI), загрузку файлов в чат.

---

## Глоссарий

- **System** — платформа ChatForge в целом.
- **AI_Context** — Elixir bounded context `ChatForge.AI`, stateless оркестратор вызовов AI API.
- **Chat_Context** — Elixir bounded context `ChatForge.Chat`, владеющий диалогами, сообщениями и лимитами.
- **Conversation** — Ecto-схема `ChatForge.Chat.Conversation`, отдельный диалог между End User-ом и AI.
- **Message** — Ecto-схема `ChatForge.Chat.Message`, единица общения в диалоге (роль: `user` или `assistant`).
- **EndUser** — Ecto-схема `ChatForge.Chat.EndUser`, конечный пользователь чат-инстанса (создана в Phase 2).
- **ChatChannel** — Phoenix Channel `ChatForgeWeb.ChatChannel`, обслуживающий топик `chat:<conversation_id>`.
- **Chat_API** — Phoenix-контроллеры, обслуживающие эндпоинты `/api/v1/chat/*`.
- **Instance_API** — Phoenix-контроллер, обслуживающий публичный эндпоинт `/api/v1/chat/instance`.
- **AIUsageLog** — Ecto-схема `ChatForge.AI.AIUsageLog`, запись об использовании AI API (токены, стоимость).
- **PubSub** — Phoenix.PubSub, шина событий платформы.
- **TenantResolver** — Plug, определяющий текущий тенант по поддомену из Host header (реализован в Phase 2).
- **AuthRequired** — Plug, проверяющий Bearer-токен End User-а (реализован в Phase 2).
- **Socket** — Phoenix JS client, WebSocket-соединение на фронтенде.
- **useChat** — React-хук `src/features/chat/hooks/useChat.ts`, управляющий подключением к ChatChannel.
- **Chat_Store** — Zustand-стор фронтенда, хранящий список диалогов и текущие сообщения.
- **Frontend_Router** — React Router, маршрутизатор фронтенда.
- **tenant_id** — идентификатор тенанта, равный `chat_instance_id`, присутствующий во всех таблицах Chat и AI контекстов.

---

## Требования

### Требование 1: AI контекст — HTTP-клиент и функция complete

**User Story:** Как разработчик, я хочу иметь stateless AI контекст с функцией вызова OpenAI API, чтобы Chat контекст мог получать AI-ответы не зная деталей HTTP-взаимодействия.

#### Критерии приёмки

1. THE AI_Context SHALL быть настроен через переменные окружения: `OPENAI_API_KEY` для ключа API, `AI_MODEL` для модели (по умолчанию `gpt-4o-mini`), `AI_BASE_URL` для базового URL (по умолчанию `https://api.openai.com/v1`).
2. IF переменная окружения `OPENAI_API_KEY` не задана при старте приложения, THEN THE AI_Context SHALL выбросить ошибку конфигурации и предотвратить запуск приложения.
3. WHEN `AI.build_messages/2` вызывается с `system_prompt` и списком `Message`-структур, THE AI_Context SHALL вернуть список сообщений в формате OpenAI Chat API: первым элементом — `%{role: "system", content: system_prompt}`, затем — сообщения диалога в хронологическом порядке.
4. WHEN `AI.complete/3` вызывается с `chat_instance_id`, `conversation_id` и списком сообщений, THE AI_Context SHALL отправить запрос к OpenAI Chat Completions API с параметром `stream: true` через HTTP-клиент `Req`.
5. WHEN OpenAI API возвращает streaming-ответ, THE AI_Context SHALL вызывать переданный callback-функцию для каждого полученного чанка текста.
6. WHEN стриминг завершён, THE AI_Context SHALL вернуть `{:ok, %{content: full_content, input_tokens: n, output_tokens: m}}` с полным текстом ответа и количеством токенов.
7. IF OpenAI API возвращает HTTP-ошибку (4xx или 5xx), THEN THE AI_Context SHALL вернуть `{:error, %{code: status_code, message: error_message}}`.
8. IF соединение с OpenAI API прерывается во время стриминга, THEN THE AI_Context SHALL вернуть `{:error, :stream_interrupted}`.

---

### Требование 2: AI контекст — логирование использования

**User Story:** Как Super Admin, я хочу видеть статистику использования AI API по каждому тенанту, чтобы контролировать расходы и выявлять аномалии.

#### Критерии приёмки

1. THE AI_Context SHALL содержать схему `ChatForge.AI.AIUsageLog`, отображающую таблицу `ai_usage_logs` с полями: `id`, `chat_instance_id`, `conversation_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `cost`, `inserted_at`.
2. WHEN `AI.complete/3` завершается успешно, THE AI_Context SHALL сохранить запись `AIUsageLog` с `provider: "openai"`, фактическим именем модели, количеством токенов и рассчитанной стоимостью.
3. THE AI_Context SHALL рассчитывать стоимость (`cost`) на основе количества токенов и тарифов модели, заданных в конфигурации.
4. IF сохранение `AIUsageLog` завершается ошибкой, THEN THE AI_Context SHALL залогировать ошибку через `Logger.error/1` и не прерывать основной поток выполнения (ошибка логирования не должна влиять на ответ пользователю).

---

### Требование 3: Chat контекст — Ecto-схемы

**User Story:** Как разработчик, я хочу иметь Ecto-схемы и changesets для диалогов и сообщений, чтобы безопасно создавать и валидировать данные чата.

#### Критерии приёмки

1. THE Chat_Context SHALL содержать схему `ChatForge.Chat.Conversation`, отображающую таблицу `conversations` с полями: `id`, `chat_instance_id`, `end_user_id`, `title`, `inserted_at`, `updated_at`.
2. THE Chat_Context SHALL содержать схему `ChatForge.Chat.Message`, отображающую таблицу `messages` с полями: `id`, `conversation_id`, `chat_instance_id`, `role`, `content`, `tokens_used`, `inserted_at`.
3. THE Chat_Context SHALL содержать changeset для `Conversation`, валидирующий: обязательность полей `chat_instance_id` и `end_user_id`; максимальную длину `title` 255 символов.
4. THE Chat_Context SHALL содержать changeset для `Message`, валидирующий: обязательность полей `conversation_id`, `chat_instance_id`, `role`, `content`; допустимые значения `role` — только `user` и `assistant`; непустое значение `content`.
5. WHEN changeset `Message` вызывается с `role` отличным от `user` или `assistant`, THE Chat_Context SHALL вернуть changeset с ошибкой валидации на поле `role`.
6. IF `content` сообщения пустой или содержит только пробелы, THEN THE Chat_Context SHALL вернуть changeset с ошибкой валидации на поле `content`.

---

### Требование 4: Chat контекст — бизнес-логика диалогов

**User Story:** Как End User, я хочу создавать, просматривать и удалять диалоги, чтобы организовывать свои разговоры с AI.

#### Критерии приёмки

1. WHEN `Chat.create_conversation/2` вызывается с валидными `end_user_id` и `tenant_id`, THE Chat_Context SHALL создать `Conversation` с автоматически сгенерированным `title` (например, дата создания) и вернуть `{:ok, conversation}`.
2. IF `Chat.create_conversation/2` вызывается с `end_user_id`, не принадлежащим данному `tenant_id`, THEN THE Chat_Context SHALL вернуть `{:error, :unauthorized}`.
3. WHEN `Chat.list_conversations/2` вызывается с `end_user_id` и `tenant_id`, THE Chat_Context SHALL вернуть список диалогов пользователя, отсортированных по `updated_at` по убыванию, отфильтрованных по `chat_instance_id`.
4. WHEN `Chat.get_conversation/3` вызывается с `conversation_id`, `end_user_id` и `tenant_id`, THE Chat_Context SHALL вернуть `{:ok, conversation}`, если диалог принадлежит данному пользователю и тенанту.
5. IF `Chat.get_conversation/3` вызывается с `conversation_id`, принадлежащим другому пользователю или тенанту, THEN THE Chat_Context SHALL вернуть `{:error, :not_found}`.
6. WHEN `Chat.delete_conversation/2` вызывается с `conversation_id` и `end_user_id`, THE Chat_Context SHALL удалить диалог и все связанные `Message`-записи и вернуть `{:ok, :deleted}`.
7. IF `Chat.delete_conversation/2` вызывается с `conversation_id`, не принадлежащим данному `end_user_id`, THEN THE Chat_Context SHALL вернуть `{:error, :not_found}`.
8. WHEN `Chat.get_messages/2` вызывается с `conversation_id` и параметрами пагинации (`page`, `per_page`), THE Chat_Context SHALL вернуть список сообщений диалога в хронологическом порядке с метаданными пагинации (`total_count`, `has_more`).

---

### Требование 5: Chat контекст — сообщения и лимиты

**User Story:** Как End User, я хочу отправлять сообщения и получать AI-ответы, при этом система должна корректно считать использованные сообщения.

#### Критерии приёмки

1. WHEN `Chat.send_message/3` вызывается с `conversation_id`, `end_user_id` и `content`, THE Chat_Context SHALL сохранить `Message` с `role: "user"` и вернуть `{:ok, message}`.
2. IF `Chat.send_message/3` вызывается с пустым `content`, THEN THE Chat_Context SHALL вернуть `{:error, changeset}`.
3. WHEN `Chat.check_limit/2` вызывается с `end_user_id` и `tenant_id`, THE Chat_Context SHALL сравнить `EndUser.messages_used` с лимитом бесплатных сообщений из настроек инстанса и вернуть `{:ok, :allowed}` или `{:error, :limit_reached}`.
4. WHEN `Chat.increment_usage/1` вызывается с `end_user_id`, THE Chat_Context SHALL атомарно увеличить поле `messages_used` на 1 и вернуть `{:ok, updated_end_user}`.
5. WHEN `Chat.save_ai_response/3` вызывается с `conversation_id`, `content` и `tokens_used`, THE Chat_Context SHALL сохранить `Message` с `role: "assistant"` и `tokens_used` и вернуть `{:ok, message}`.
6. WHEN `Chat.send_message/3` успешно сохраняет сообщение, THE Chat_Context SHALL опубликовать событие `message.sent` через PubSub с данными `%{conversation_id: id, tenant_id: tenant_id}`.
7. THE Chat_Context SHALL обеспечить, что все запросы к таблицам `conversations` и `messages` фильтруются по `chat_instance_id`.

---

### Требование 6: Phoenix Channel — streaming AI-ответов

**User Story:** Как End User, я хочу получать ответы AI в режиме реального времени по мере их генерации, чтобы не ждать полного ответа перед отображением.

#### Критерии приёмки

1. THE ChatChannel SHALL обслуживать топик `chat:<conversation_id>` и требовать валидного Bearer-токена End User-а при подключении (`join/3`).
2. IF при подключении к ChatChannel токен невалиден или `conversation_id` не принадлежит данному End User-у, THEN THE ChatChannel SHALL вернуть `{:error, %{reason: "unauthorized"}}` и отклонить подключение.
3. WHEN ChatChannel получает событие `send_message` с `%{content: text}`, THE ChatChannel SHALL вызвать `Chat.check_limit/2`.
4. IF `Chat.check_limit/2` возвращает `{:error, :limit_reached}`, THEN THE ChatChannel SHALL отправить клиенту событие `limit_reached` и не вызывать AI.
5. WHEN лимит не исчерпан, THE ChatChannel SHALL вызвать `Chat.send_message/3`, затем `Chat.increment_usage/1`, затем `AI.complete/3` с callback-функцией для стриминга.
6. WHILE AI_Context стримит ответ, THE ChatChannel SHALL отправлять клиенту события `message_chunk` с `%{content: chunk}` для каждого полученного чанка.
7. WHEN стриминг завершён, THE ChatChannel SHALL вызвать `Chat.save_ai_response/3` и отправить клиенту событие `message_done` с `%{message_id: id, content: full_content}`.
8. IF `AI.complete/3` возвращает ошибку, THEN THE ChatChannel SHALL отправить клиенту событие `message_error` с `%{reason: error_message}` и не сохранять неполный ответ.
9. THE ChatChannel SHALL обрабатывать каждое сообщение в отдельном процессе, чтобы стриминг одного сообщения не блокировал другие операции канала.

---

### Требование 7: REST API — диалоги

**User Story:** Как End User, я хочу иметь REST API для управления диалогами и просмотра истории сообщений, чтобы фронтенд мог загружать и отображать данные.

#### Критерии приёмки

1. WHEN `GET /api/v1/chat/conversations` получает запрос от аутентифицированного End User-а, THE Chat_API SHALL вернуть HTTP 200 со списком диалогов пользователя в текущем тенанте.
2. WHEN `POST /api/v1/chat/conversations` получает запрос от аутентифицированного End User-а, THE Chat_API SHALL создать новый диалог и вернуть HTTP 201 с данными созданного `Conversation`.
3. WHEN `DELETE /api/v1/chat/conversations/:id` получает запрос от аутентифицированного End User-а, THE Chat_API SHALL удалить диалог и вернуть HTTP 200.
4. IF `DELETE /api/v1/chat/conversations/:id` вызывается для диалога, не принадлежащего текущему End User-у, THEN THE Chat_API SHALL вернуть HTTP 404.
5. WHEN `GET /api/v1/chat/conversations/:id/messages` получает запрос с параметрами `?page=1&per_page=50`, THE Chat_API SHALL вернуть HTTP 200 с пагинированным списком сообщений и метаданными `%{total_count, has_more, page, per_page}`.
6. IF `GET /api/v1/chat/conversations/:id/messages` вызывается для диалога, не принадлежащего текущему End User-у, THEN THE Chat_API SHALL вернуть HTTP 404.
7. THE Chat_API SHALL требовать аутентификации End User-а для всех эндпоинтов: запросы без валидного Bearer-токена SHALL получать HTTP 401.
8. THE Chat_API SHALL обеспечить tenant-изоляцию: End User одного тенанта не может получить доступ к диалогам другого тенанта.

---

### Требование 8: REST API — публичный лендинг инстанса

**User Story:** Как посетитель чата, я хочу видеть публичную информацию об AI-чате без авторизации, чтобы понять, что это за чат, перед регистрацией.

#### Критерии приёмки

1. WHEN `GET /api/v1/chat/instance` получает запрос в контексте тенанта (с корректным поддоменом), THE Instance_API SHALL вернуть HTTP 200 с публичными данными инстанса: `name`, `primary_color`, `secondary_color`, `background_color`, `avatar_url`, `greeting_text`, `example_questions`.
2. THE Instance_API SHALL не требовать аутентификации: запросы без токена SHALL получать те же данные, что и авторизованные запросы.
3. IF тенант не найден (некорректный поддомен), THEN THE Instance_API SHALL вернуть HTTP 404.
4. THE Instance_API SHALL не возвращать приватные данные инстанса: `system_prompt`, `creator_id`, финансовые настройки.

---

### Требование 9: Frontend — лендинг чата

**User Story:** Как посетитель чата, я хочу видеть привлекательный лендинг с информацией об AI-чате, чтобы понять его назначение и начать общение.

#### Критерии приёмки

1. THE Frontend_Router SHALL содержать страницу `/` (в контексте поддомена чата), загружающую данные через `GET /api/v1/chat/instance` при монтировании.
2. WHEN данные инстанса загружены, THE Frontend_Router SHALL отобразить: аватар AI, название чата, текст приветствия, список примеров вопросов в виде кликабельных кнопок.
3. WHEN посетитель нажимает на кнопку примера вопроса, THE Frontend_Router SHALL перенаправить его на страницу входа/регистрации с предзаполненным текстом вопроса в параметре URL.
4. THE Frontend_Router SHALL отображать кнопку "Начать чат": WHEN End User не аутентифицирован, кнопка SHALL вести на `/chat/login`; WHEN End User аутентифицирован, кнопка SHALL вести на `/chat`.
5. WHILE данные инстанса загружаются, THE Frontend_Router SHALL отображать skeleton-загрузчик вместо контента.
6. IF запрос к `GET /api/v1/chat/instance` завершается ошибкой, THEN THE Frontend_Router SHALL отобразить сообщение об ошибке.

---

### Требование 10: Frontend — список диалогов

**User Story:** Как End User, я хочу видеть список своих диалогов и управлять ими, чтобы легко переключаться между разговорами или начинать новые.

#### Критерии приёмки

1. THE Frontend_Router SHALL содержать страницу `/chat`, доступную только аутентифицированным End User-ам, загружающую список диалогов через `GET /api/v1/chat/conversations`.
2. WHEN список диалогов загружен и не пуст, THE Frontend_Router SHALL отобразить каждый диалог с: заголовком (или датой создания), временем последнего обновления, кнопкой удаления.
3. WHEN End User нажимает на диалог, THE Frontend_Router SHALL перейти на страницу `/chat/:id`.
4. WHEN End User нажимает кнопку "Новый диалог", THE Frontend_Router SHALL вызвать `POST /api/v1/chat/conversations` и при успехе перейти на страницу нового диалога `/chat/:id`.
5. WHEN End User нажимает кнопку удаления диалога, THE Frontend_Router SHALL запросить подтверждение, затем вызвать `DELETE /api/v1/chat/conversations/:id` и обновить список.
6. WHEN список диалогов пуст, THE Frontend_Router SHALL отобразить пустое состояние с иллюстрацией и текстом "Начните первый диалог".
7. WHILE список диалогов загружается, THE Frontend_Router SHALL отображать skeleton-загрузчик.

---

### Требование 11: Frontend — интерфейс диалога

**User Story:** Как End User, я хочу иметь удобный интерфейс диалога с AI, где сообщения отображаются в реальном времени, чтобы общение было комфортным и интуитивным.

#### Критерии приёмки

1. THE Frontend_Router SHALL содержать страницу `/chat/:id`, загружающую историю сообщений через `GET /api/v1/chat/conversations/:id/messages` при монтировании.
2. WHEN история сообщений загружена, THE Frontend_Router SHALL отобразить сообщения в виде пузырей: сообщения пользователя — справа, сообщения ассистента — слева с аватаром AI.
3. THE Frontend_Router SHALL рендерить содержимое сообщений ассистента через `react-markdown` с поддержкой базового Markdown (заголовки, списки, код, жирный текст).
4. THE Frontend_Router SHALL содержать поле ввода сообщения: нажатие `Enter` SHALL отправить сообщение; нажатие `Shift+Enter` SHALL добавить перенос строки.
5. WHILE AI генерирует ответ, THE Frontend_Router SHALL отображать индикатор "печатает..." рядом с аватаром ассистента и блокировать поле ввода.
6. WHEN приходит событие `message_chunk`, THE Frontend_Router SHALL добавлять текст чанка к текущему сообщению ассистента в реальном времени.
7. WHEN приходит событие `message_done`, THE Frontend_Router SHALL заменить стримящееся сообщение финальным и разблокировать поле ввода.
8. WHEN добавляется новое сообщение или чанк, THE Frontend_Router SHALL автоматически прокручивать страницу вниз, если пользователь находится в нижней части чата.
9. IF приходит событие `limit_reached`, THE Frontend_Router SHALL отобразить компонент-заглушку paywall (без функционала оплаты — Phase 5) и заблокировать поле ввода.
10. IF приходит событие `message_error`, THE Frontend_Router SHALL отобразить toast-уведомление с текстом ошибки через `Sonner`.

---

### Требование 12: Frontend — WebSocket подключение

**User Story:** Как разработчик, я хочу иметь надёжный WebSocket-клиент с хуком для управления состоянием чата, чтобы компоненты диалога могли легко подключаться к Phoenix Channel.

#### Критерии приёмки

1. THE System SHALL содержать модуль `src/shared/lib/socket.ts`, создающий и экспортирующий Phoenix Socket с URL из переменной окружения `VITE_WS_URL` и Bearer-токеном End User-а в параметрах подключения.
2. WHEN End User аутентифицирован, THE Socket SHALL автоматически подключаться; WHEN End User выходит из системы, THE Socket SHALL отключаться.
3. THE System SHALL содержать хук `useChat(conversationId)`, возвращающий: `messages`, `sendMessage`, `isStreaming`, `error`.
4. WHEN `useChat` монтируется с `conversationId`, THE useChat SHALL подключиться к каналу `chat:<conversationId>` и подписаться на события `message_chunk`, `message_done`, `message_error`, `limit_reached`.
5. WHEN `useChat` размонтируется, THE useChat SHALL отключиться от канала и освободить ресурсы.
6. WHEN `sendMessage(content)` вызывается, THE useChat SHALL отправить событие `send_message` в канал и добавить сообщение пользователя в локальный список `messages` оптимистично (до подтверждения сервера).
7. IF WebSocket-соединение разрывается, THE Socket SHALL автоматически переподключиться с экспоненциальной задержкой.

---

## Свойства корректности (Correctness Properties)

Данный раздел описывает свойства для Property-Based Testing (PBT).

### CP-1: Инвариант tenant-изоляции диалогов

Для любых двух End User-ов `A` и `B`, принадлежащих разным тенантам: `Chat.list_conversations(A.id, A.tenant_id)` SHALL никогда не содержать диалоги, принадлежащие тенанту `B`.

### CP-2: Round-trip — создание и получение диалога

Для любого валидного `end_user_id` и `tenant_id`: если `Chat.create_conversation/2` вернул `{:ok, conv}`, то `Chat.get_conversation(conv.id, end_user_id, tenant_id)` SHALL вернуть `{:ok, conversation}` с теми же `id` и `chat_instance_id`.

### CP-3: Инвариант удаления — каскадное удаление сообщений

Для любого `conversation_id`: после успешного вызова `Chat.delete_conversation/2` вызов `Chat.get_messages(conversation_id, %{})` SHALL вернуть пустой список (все сообщения удалены вместе с диалогом).

### CP-4: Инвариант счётчика сообщений

Для любого `end_user_id`: после N успешных вызовов `Chat.increment_usage/1` значение `EndUser.messages_used` SHALL быть равно начальному значению плюс N.

### CP-5: Инвариант порядка сообщений

Для любого `conversation_id`: список, возвращаемый `Chat.get_messages/2`, SHALL быть отсортирован по `inserted_at` по возрастанию (хронологический порядок).

### CP-6: Инвариант роли сообщения

Для любого `Message`, сохранённого через `Chat.send_message/3`: поле `role` SHALL быть `"user"`. Для любого `Message`, сохранённого через `Chat.save_ai_response/3`: поле `role` SHALL быть `"assistant"`.

### CP-7: Round-trip — сборка и разбор сообщений для AI

Для любого списка `Message`-структур `msgs`: `AI.build_messages(system_prompt, msgs)` SHALL вернуть список, где первый элемент имеет `role: "system"`, а остальные элементы соответствуют `msgs` в том же порядке с сохранёнными `role` и `content`.

### CP-8: Идемпотентность проверки лимита

Для любого `end_user_id`: повторный вызов `Chat.check_limit/2` без изменения `messages_used` SHALL возвращать тот же результат (`{:ok, :allowed}` или `{:error, :limit_reached}`).
