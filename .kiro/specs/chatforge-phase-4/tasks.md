# План реализации: ChatForge Phase 4 — AI-чат (диалоги, сообщения, streaming)

## Обзор

Последовательная реализация: миграции и Ecto-схемы → AI контекст (HTTP-клиент, streaming, логирование) → Chat контекст (бизнес-логика диалогов, сообщений, лимитов) → Phoenix Channel (streaming) → REST API (ChatController, ChatInstanceController) → Frontend (типы, API, Store, Socket, хук useChat) → страницы (лендинг, список диалогов, интерфейс диалога) → обновление роутинга. Каждый шаг строится на предыдущем и заканчивается интеграцией всех частей.

## Задачи

- [x] 1. Миграции базы данных
  - [x] 1.1 Создать миграцию для таблицы `conversations`
    - Создать файл миграции в `backend/priv/repo/migrations/`
    - Поля: `id UUID PK`, `chat_instance_id UUID FK`, `end_user_id UUID FK`, `title VARCHAR(255)`, `inserted_at`, `updated_at`
    - Индексы: `end_user_id`, `chat_instance_id`, `updated_at DESC`
    - Каскадное удаление при удалении `chat_instances` и `end_users`
    - _Требования: 3.1_

  - [x] 1.2 Создать миграцию для таблицы `messages`
    - Создать файл миграции в `backend/priv/repo/migrations/`
    - Поля: `id UUID PK`, `conversation_id UUID FK`, `chat_instance_id UUID FK`, `role VARCHAR(20) CHECK IN ('user','assistant')`, `content TEXT`, `tokens_used INTEGER DEFAULT 0`, `inserted_at`
    - Индексы: `conversation_id`, `chat_instance_id`, `inserted_at ASC`
    - Каскадное удаление при удалении `conversations`
    - _Требования: 3.2_

  - [x] 1.3 Создать миграцию для таблицы `ai_usage_logs`
    - Создать файл миграции в `backend/priv/repo/migrations/`
    - Поля: `id UUID PK`, `chat_instance_id UUID FK`, `conversation_id UUID FK`, `provider VARCHAR(50)`, `model VARCHAR(100)`, `input_tokens INTEGER`, `output_tokens INTEGER`, `cost DECIMAL(10,6)`, `inserted_at`
    - Индексы: `chat_instance_id`, `conversation_id`, `inserted_at DESC`
    - _Требования: 2.1_

- [x] 2. Chat контекст — Ecto-схемы
  - [x] 2.1 Реализовать схему `ChatForge.Chat.Conversation`
    - Создать `backend/lib/chatforge/chat/conversation.ex`
    - Поля: `title`, `belongs_to :chat_instance`, `belongs_to :end_user`, `timestamps()`
    - Changeset: валидация обязательных `chat_instance_id`, `end_user_id`; `validate_length(:title, max: 255)`; FK-ограничения
    - _Требования: 3.1, 3.3_

  - [x] 2.2 Реализовать схему `ChatForge.Chat.Message`
    - Создать `backend/lib/chatforge/chat/message.ex`
    - Поля: `role`, `content`, `tokens_used`, `belongs_to :conversation`, `belongs_to :chat_instance`, `timestamps(updated_at: false)`
    - Changeset: валидация обязательных полей; `validate_inclusion(:role, ["user", "assistant"])`; `validate_length(:content, min: 1)`; кастомная валидация пробельного content; FK-ограничения
    - _Требования: 3.2, 3.4, 3.5, 3.6_

  - [ ]* 2.3 Написать property-тест для валидации changeset Message
    - **Свойство 9: Инвариант валидации changeset Message**
    - **Validates: Requirements 3.4, 3.5, 3.6**
    - Для любой строки `role` вне `["user", "assistant"]` — changeset невалиден с ошибкой на `:role`
    - Для любой строки `content` из пробелов или пустой — changeset невалиден с ошибкой на `:content`

- [x] 3. AI контекст — конфигурация и схема AIUsageLog
  - [x] 3.1 Создать модуль `ChatForge.AI` с конфигурацией
    - Создать `backend/lib/chatforge/ai/ai.ex`
    - Чтение конфигурации из env: `OPENAI_API_KEY`, `AI_MODEL` (default: `gpt-4o-mini`), `AI_BASE_URL` (default: `https://api.openai.com/v1`)
    - При отсутствии `OPENAI_API_KEY` — выбросить ошибку конфигурации при старте через `Application.fetch_env!/2`
    - _Требования: 1.1, 1.2_

  - [x] 3.2 Реализовать схему `ChatForge.AI.AIUsageLog`
    - Создать `backend/lib/chatforge/ai/ai_usage_log.ex`
    - Поля: `provider`, `model`, `input_tokens`, `output_tokens`, `cost :decimal`, `belongs_to :chat_instance`, `belongs_to :conversation`, `timestamps(updated_at: false)`
    - Changeset: валидация обязательных полей; `validate_inclusion(:provider, ["openai"])`; `validate_number` для токенов
    - _Требования: 2.1_

- [-] 4. AI контекст — функции build_messages, complete, log_usage
  - [x] 4.1 Реализовать `AI.build_messages/2`
    - В `backend/lib/chatforge/ai/ai.ex` добавить функцию `build_messages(system_prompt, messages)`
    - Возвращает список: первый элемент `%{role: "system", content: system_prompt}`, затем сообщения в том же порядке как `%{role: msg.role, content: msg.content}`
    - _Требования: 1.3_

  - [ ]* 4.2 Написать property-тест для `AI.build_messages/2`
    - **Свойство 7: Round-trip — сборка сообщений для AI**
    - **Validates: Requirements 1.3**
    - Для любого `system_prompt` и любого списка сообщений: первый элемент — system, остальные в том же порядке, длина = `length(msgs) + 1`

  - [x] 4.3 Реализовать `AI.complete/4` со streaming через Req
    - В `backend/lib/chatforge/ai/ai.ex` добавить функцию `complete(chat_instance_id, conversation_id, messages, callback)`
    - Отправить POST к OpenAI Chat Completions API с `stream: true` через `Req`
    - Парсить SSE-чанки, вызывать `callback.(chunk)` для каждого текстового чанка
    - При успехе вернуть `{:ok, %{content: full_content, input_tokens: n, output_tokens: m}}`
    - При HTTP 4xx/5xx вернуть `{:error, %{code: status, message: body}}`
    - При разрыве соединения вернуть `{:error, :stream_interrupted}`
    - После успешного завершения вызвать `AI.log_usage/1` (ошибка логирования не прерывает поток)
    - _Требования: 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 4.4 Реализовать `AI.log_usage/1`
    - В `backend/lib/chatforge/ai/ai.ex` добавить функцию `log_usage(attrs)`
    - Рассчитать `cost` на основе токенов и тарифов модели из конфигурации
    - Сохранить `AIUsageLog` через Repo; при ошибке — `Logger.error/1`, не прерывать поток
    - _Требования: 2.2, 2.3, 2.4_

  - [ ]* 4.5 Написать property-тест для логирования AI
    - **Свойство 10: Логирование использования AI после успешного вызова**
    - **Validates: Requirements 2.2, 2.3**
    - После успешного `AI.complete/3` в `ai_usage_logs` появляется запись с корректными `chat_instance_id`, `conversation_id`, `input_tokens + output_tokens > 0`, `cost >= 0`

- [x] 5. Chat контекст — бизнес-логика диалогов
  - [x] 5.1 Создать модуль `ChatForge.Chat` с функциями управления диалогами
    - Создать `backend/lib/chatforge/chat/chat.ex`
    - `create_conversation/2` — создаёт `Conversation` с `title` = дата создания (например, `"Диалог от #{Date.utc_today()}"`); проверяет принадлежность `end_user` к тенанту; возвращает `{:ok, conv}` или `{:error, :unauthorized}`
    - `list_conversations/2` — список диалогов пользователя, фильтр по `chat_instance_id`, сортировка `updated_at DESC`
    - `get_conversation/3` — получить диалог с проверкой `end_user_id` и `chat_instance_id`; `{:ok, conv}` или `{:error, :not_found}`
    - `delete_conversation/2` — удалить диалог (каскад на сообщения); `{:ok, :deleted}` или `{:error, :not_found}`
    - `get_messages/2` — список сообщений с пагинацией (`page`, `per_page`), сортировка `inserted_at ASC`; возвращает `%{messages: [...], total_count: n, has_more: bool}`
    - _Требования: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 5.2 Написать property-тест: инвариант tenant-изоляции диалогов
    - **Свойство 1: Инвариант tenant-изоляции диалогов**
    - **Validates: Requirements 4.2, 4.5, 5.7, 7.8**

  - [ ]* 5.3 Написать property-тест: round-trip создание и получение диалога
    - **Свойство 2: Round-trip — создание и получение диалога**
    - **Validates: Requirements 4.1, 4.4**

  - [ ]* 5.4 Написать property-тест: каскадное удаление сообщений
    - **Свойство 3: Инвариант каскадного удаления сообщений**
    - **Validates: Requirements 4.6**

  - [ ]* 5.5 Написать property-тест: порядок сообщений
    - **Свойство 5: Инвариант порядка сообщений**
    - **Validates: Requirements 4.8**

  - [ ]* 5.6 Написать property-тест: порядок диалогов по updated_at
    - **Свойство 12: Порядок диалогов по updated_at DESC**
    - **Validates: Requirements 4.3**

- [x] 6. Chat контекст — сообщения и лимиты
  - [x] 6.1 Реализовать функции сообщений и лимитов в `ChatForge.Chat`
    - `send_message/3` — сохранить `Message` с `role: "user"`; опубликовать событие `message.sent` через PubSub; `{:ok, msg}` или `{:error, changeset}`
    - `save_ai_response/3` — сохранить `Message` с `role: "assistant"` и `tokens_used`; `{:ok, msg}` или `{:error, changeset}`
    - `check_limit/2` — сравнить `EndUser.messages_used` с `free_messages_limit` инстанса; `{:ok, :allowed}` или `{:error, :limit_reached}`; если `free_messages_limit == nil` → `{:ok, :allowed}`
    - `increment_usage/1` — атомарно увеличить `messages_used` на 1 через `Repo.update_all`; `{:ok, updated_end_user}`
    - _Требования: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 6.2 Написать property-тест: инвариант счётчика сообщений
    - **Свойство 4: Инвариант счётчика сообщений**
    - **Validates: Requirements 5.4**

  - [ ]* 6.3 Написать property-тест: инвариант роли сообщения
    - **Свойство 6: Инвариант роли сообщения**
    - **Validates: Requirements 5.1, 5.5**

  - [ ]* 6.4 Написать property-тест: идемпотентность проверки лимита
    - **Свойство 8: Идемпотентность проверки лимита**
    - **Validates: Requirements 5.3**

- [x] 7. Checkpoint — убедиться, что все backend-тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 8. Phoenix Channel — ChatChannel
  - [x] 8.1 Реализовать `ChatForgeWeb.ChatChannel`
    - Создать `backend/lib/chatforge_web/channels/chat_channel.ex`
    - `join("chat:" <> conversation_id, %{"token" => token}, socket)` — верифицировать токен через Guardian; проверить принадлежность диалога пользователю и тенанту; `{:ok, socket}` или `{:error, %{reason: "unauthorized"}}`
    - `handle_in("send_message", %{"content" => content}, socket)` — вызвать `Chat.check_limit/2`; при `:limit_reached` — `push(socket, "limit_reached", %{})`; иначе запустить `Task.async` для стриминга
    - В Task: `Chat.send_message/3` → `Chat.increment_usage/1` → `AI.complete/4` с callback `push(socket, "message_chunk", %{content: chunk})`
    - По завершении: `Chat.save_ai_response/3` → `push(socket, "message_done", %{message_id: id, content: full})`
    - При ошибке AI: `push(socket, "message_error", %{reason: msg})`
    - _Требования: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 8.2 Зарегистрировать канал в UserSocket
    - В `backend/lib/chatforge_web/channels/user_socket.ex` добавить `channel "chat:*", ChatForgeWeb.ChatChannel`
    - _Требования: 6.1_

  - [ ]* 8.3 Написать property-тест: изоляция диалогов в ChatChannel
    - **Свойство 11: Изоляция диалогов в ChatChannel**
    - **Validates: Requirements 6.1, 6.2**
    - Попытка подключиться к чужому диалогу возвращает `{:error, %{reason: "unauthorized"}}`

- [x] 9. REST API — ChatInstanceController
  - [x] 9.1 Реализовать `ChatForgeWeb.ChatInstanceController`
    - Создать `backend/lib/chatforge_web/controllers/chat_instance_controller.ex`
    - `show/2` — `GET /api/v1/chat/instance`: вернуть публичные поля инстанса (`name`, `primary_color`, `secondary_color`, `background_color`, `avatar_url`, `greeting_text`, `example_questions`) из `conn.assigns.tenant`; HTTP 200 или HTTP 404
    - Не возвращать `system_prompt`, `creator_id`, финансовые настройки
    - _Требования: 8.1, 8.2, 8.3, 8.4_

  - [x] 9.2 Добавить маршрут в роутер для ChatInstanceController
    - В `backend/lib/chatforge_web/router.ex` добавить scope с `pipe_through [:api, :chat_tenant]`
    - `get "/instance", ChatInstanceController, :show`
    - _Требования: 8.1_

- [x] 10. REST API — ChatController
  - [x] 10.1 Реализовать `ChatForgeWeb.ChatController`
    - Создать `backend/lib/chatforge_web/controllers/chat_controller.ex`
    - `index/2` — `GET /api/v1/chat/conversations`: вернуть список диалогов через `Chat.list_conversations/2`; HTTP 200
    - `create/2` — `POST /api/v1/chat/conversations`: создать диалог через `Chat.create_conversation/2`; HTTP 201 или HTTP 422
    - `delete/2` — `DELETE /api/v1/chat/conversations/:id`: удалить через `Chat.delete_conversation/2`; HTTP 200 или HTTP 404
    - `messages/2` — `GET /api/v1/chat/conversations/:id/messages`: получить сообщения с пагинацией; HTTP 200 с `%{messages, total_count, has_more, page, per_page}` или HTTP 404
    - _Требования: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 10.2 Добавить маршруты в роутер для ChatController
    - В `backend/lib/chatforge_web/router.ex` добавить scope с `pipe_through [:api, :chat_tenant, :authenticated]`
    - Маршруты: `get "/conversations"`, `post "/conversations"`, `delete "/conversations/:id"`, `get "/conversations/:id/messages"`
    - _Требования: 7.7_

- [x] 11. Checkpoint — убедиться, что все backend-тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 12. Frontend — установка зависимостей и типы
  - [x] 12.1 Установить npm-пакеты `phoenix` и `react-markdown`
    - Добавить `phoenix` и `react-markdown` в `frontend/package.json`
    - _Требования: 11.3, 12.1_

  - [x] 12.2 Создать `frontend/src/features/chat/types.ts`
    - Типы: `Conversation` (`id`, `title`, `inserted_at`, `updated_at`), `Message` (`id`, `role`, `content`, `tokens_used`, `inserted_at`), `InstanceInfo` (`name`, `primary_color`, `secondary_color`, `background_color`, `avatar_url`, `greeting_text`, `example_questions`)
    - _Требования: 9.1, 10.1, 11.1_

- [x] 13. Frontend — Phoenix Socket и API
  - [x] 13.1 Создать `frontend/src/shared/lib/socket.ts`
    - Singleton Phoenix Socket с URL из `VITE_WS_URL` и Bearer-токеном из `endUserAuthStore`
    - Экспортировать `getSocket()`, `connectSocket()`, `disconnectSocket()`
    - _Требования: 12.1, 12.2, 12.7_

  - [x] 13.2 Создать `frontend/src/features/chat/api.ts`
    - Типизированные функции: `fetchConversations()`, `createConversation()`, `deleteConversation(id)`, `fetchMessages(id, page, perPage)`, `fetchInstanceInfo()`
    - Использует `API_Client` из `shared/lib/api.ts`
    - _Требования: 9.1, 10.1, 11.1_

- [x] 14. Frontend — Zustand Chat Store
  - [x] 14.1 Создать `frontend/src/features/chat/chatStore.ts`
    - Поля: `conversations`, `conversationsLoading`, `messages`, `messagesLoading`, `instanceInfo`, `instanceLoading`
    - Методы: `fetchConversations`, `createConversation`, `deleteConversation`, `fetchMessages`, `fetchInstanceInfo`, `addMessage`, `updateStreamingMessage`, `finalizeStreamingMessage`, `reset`
    - _Требования: 9.1, 10.1, 11.1, 12.3_

- [x] 15. Frontend — хук useChat
  - [x] 15.1 Реализовать `frontend/src/features/chat/hooks/useChat.ts`
    - При монтировании: подключиться к каналу `chat:<conversationId>`, подписаться на `message_chunk`, `message_done`, `message_error`, `limit_reached`
    - `message_chunk` → `chatStore.updateStreamingMessage(chunk)`
    - `message_done` → `chatStore.finalizeStreamingMessage(id, content)`, `isStreaming = false`
    - `message_error` → установить `error`, показать toast через Sonner
    - `limit_reached` → установить флаг `isLimitReached`
    - `sendMessage(content)` → оптимистично добавить сообщение в store, отправить `send_message` в канал
    - При размонтировании: `channel.leave()`
    - Возвращает: `{ messages, sendMessage, isStreaming, error, isLimitReached }`
    - _Требования: 12.3, 12.4, 12.5, 12.6_

- [x] 16. Frontend — страница лендинга чата
  - [x] 16.1 Реализовать `frontend/src/pages/chat/landing/ChatLandingPage.tsx`
    - При монтировании: `chatStore.fetchInstanceInfo()`
    - Отображать: аватар AI, название, `greeting_text`, `example_questions` как кнопки
    - Клик на пример вопроса → редирект на `/chat/login?question=<encoded>`
    - Кнопка "Начать чат": аутентифицирован → `/chat`, иначе → `/chat/login`
    - Skeleton-загрузчик пока `instanceLoading = true`
    - Сообщение об ошибке при неудачном запросе
    - _Требования: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 17. Frontend — страница списка диалогов
  - [x] 17.1 Реализовать `frontend/src/pages/chat/conversations/ConversationsPage.tsx`
    - Защищённый маршрут (редирект на `/chat/login` если не аутентифицирован)
    - При монтировании: `chatStore.fetchConversations()`
    - Список диалогов: заголовок, время обновления, кнопка удаления с подтверждением
    - Клик на диалог → navigate `/chat/:id`
    - Кнопка "Новый диалог" → `createConversation()` → navigate `/chat/:id`
    - Пустое состояние с текстом "Начните первый диалог"
    - Skeleton-загрузчик пока `conversationsLoading = true`
    - _Требования: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 18. Frontend — страница интерфейса диалога
  - [x] 18.1 Реализовать `frontend/src/pages/chat/conversation/ConversationPage.tsx`
    - Защищённый маршрут
    - При монтировании: `chatStore.fetchMessages(id)` + `useChat(id)`
    - Пузыри сообщений: `user` — справа, `assistant` — слева с аватаром AI
    - Рендеринг сообщений ассистента через `react-markdown`
    - Поле ввода: `Enter` → отправить, `Shift+Enter` → перенос строки
    - Индикатор "печатает..." при `isStreaming = true`, блокировка поля ввода
    - Автоскролл вниз при новых сообщениях/чанках (если пользователь внизу)
    - Paywall-заглушка при `isLimitReached = true`, блокировка поля ввода
    - Toast-уведомление при `message_error` через Sonner
    - _Требования: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

- [x] 19. Frontend — обновление роутинга
  - [x] 19.1 Обновить `frontend/src/app/App.tsx` — добавить chat-маршруты
    - Добавить маршруты: `/` → `ChatLandingPage`, `/chat` → `ConversationsPage`, `/chat/:id` → `ConversationPage`
    - Подключить/отключить Socket при изменении состояния аутентификации End User-а
    - _Требования: 9.1, 10.1, 11.1, 12.2_

- [x] 20. Финальный checkpoint — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

## Примечания

- Задачи с `*` опциональны и могут быть пропущены для ускорения MVP
- Каждая задача ссылается на конкретные требования для трассируемости
- Property-тесты используют `stream_data`, минимум 100 итераций (`max_runs: 100`)
- Запуск backend-тестов: `mix test`; frontend-тестов: `cd frontend && npx vitest --run`
- Комментарии в коде — на русском языке
