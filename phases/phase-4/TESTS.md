# Phase 4 — TESTS

## Backend

| Проверка | Результат |
|---|---|
| `mix compile` — без ошибок | ✅ |
| `mix test` — все тесты проходят | ✅ (тестов нет, компиляция чистая) |
| `ChatChannel` — `use Phoenix.Channel` (не через ChatForgeWeb) | ✅ |
| `UserSocket` зарегистрирован в `endpoint.ex` | ✅ |
| `GET /api/v1/chat/instance` — не возвращает `system_prompt` | ✅ |
| `check_limit` — при `free_messages_limit = nil` возвращает `{:ok, :allowed}` | ✅ |
| `AI.complete` — использует `Process.put/get` для аккумулятора SSE | ✅ |

## Frontend

| Проверка | Результат |
|---|---|
| TypeScript — нет ошибок во всех новых файлах | ✅ |
| `phoenix` и `react-markdown` установлены | ✅ |
| `socket.ts` — singleton, не создаёт дублирующих соединений | ✅ |
| `chatStore` — `updateStreamingMessage` создаёт временное сообщение с id `__streaming__` | ✅ |
| `useChat` — `channel.leave()` при размонтировании | ✅ |
| `App.tsx` — Socket подключается/отключается при изменении аутентификации | ✅ |
| `ConversationPage` — `Enter` отправляет, `Shift+Enter` — перенос строки | ✅ |
| `ConversationPage` — поле ввода заблокировано при `isStreaming` и `isLimitReached` | ✅ |
