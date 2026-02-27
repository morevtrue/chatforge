# Phase 4 — DONE

## Что реализовано

### Backend

**Миграции:**
- `conversations` — диалоги с FK на `chat_instances` и `end_users`, каскадное удаление
- `messages` — сообщения с ролью `user`/`assistant`, FK на `conversations`
- `ai_usage_logs` — логи использования AI API с токенами и стоимостью

**Ecto-схемы:**
- `ChatForge.Chat.Conversation` — changeset с валидацией обязательных полей
- `ChatForge.Chat.Message` — changeset с `validate_inclusion(:role, ["user", "assistant"])`
- `ChatForge.AI.AIUsageLog` — changeset с валидацией токенов и провайдера

**AI контекст (`ChatForge.AI`):**
- `build_messages/2` — сборка массива сообщений (system + история)
- `complete/4` — streaming через Req + SSE-парсинг, callback на каждый чанк
- `log_usage/1` — сохранение AIUsageLog с расчётом стоимости по тарифам модели
- Конфигурация через env: `OPENAI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`

**Chat контекст (`ChatForge.Chat`):**
- `create_conversation/2`, `list_conversations/2`, `get_conversation/3`, `delete_conversation/2`
- `get_messages/2` — пагинация, сортировка `inserted_at ASC`
- `send_message/3` — сохранение + PubSub событие
- `save_ai_response/3` — сохранение ответа AI + обновление `updated_at` диалога
- `check_limit/2` — проверка `messages_used` vs `free_messages_limit`
- `increment_usage/1` — атомарный инкремент через `Repo.update_all`

**Phoenix Channel (`ChatForgeWeb.ChatChannel`):**
- Топик `chat:<conversation_id>`, аутентификация через Guardian в `UserSocket`
- `handle_in("send_message")` — проверка лимита, запуск Task для стриминга
- События: `message_chunk`, `message_done`, `message_error`, `limit_reached`

**REST API:**
- `GET /api/v1/chat/instance` — публичные поля инстанса (без system_prompt)
- `GET/POST/DELETE /api/v1/chat/conversations` — CRUD диалогов
- `GET /api/v1/chat/conversations/:id/messages` — история с пагинацией

**WebSocket:**
- `UserSocket` зарегистрирован в `endpoint.ex` на `/socket`

### Frontend

- `features/chat/types.ts` — типы `Conversation`, `Message`, `InstanceInfo`
- `shared/lib/socket.ts` — singleton Phoenix Socket (`connectSocket`, `disconnectSocket`, `getSocket`)
- `features/chat/api.ts` — типизированные API-функции
- `features/chat/chatStore.ts` — Zustand-стор с поддержкой стриминга (`updateStreamingMessage`, `finalizeStreamingMessage`)
- `features/chat/hooks/useChat.ts` — хук для Phoenix Channel (стриминг, лимиты, ошибки)
- `pages/chat/landing/ChatLandingPage.tsx` — лендинг с аватаром, приветствием, примерами вопросов
- `pages/chat/conversations/ConversationsPage.tsx` — список диалогов с удалением
- `pages/chat/conversation/ConversationPage.tsx` — интерфейс диалога, react-markdown, автоскролл
- `app/App.tsx` — обновлён роутинг, управление Socket при изменении аутентификации

## Ограничения

- Подписки и paywall — не входили в фазу (Phase 5)
- Несколько AI-провайдеров — только OpenAI/GitHub Models
- Загрузка файлов в чат — не входила

## Что не входило

- Платёжная интеграция
- Push-уведомления
- Экспорт истории диалогов
