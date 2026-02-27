# Дизайн — ChatForge Phase 4: AI-чат (диалоги, сообщения, streaming)

## Обзор

Phase 4 реализует основной функционал платформы ChatForge — AI-чат для конечных пользователей.
End User создаёт диалоги, отправляет сообщения и получает ответы от AI в режиме реального времени
через streaming по WebSocket. История сообщений сохраняется, лимиты использования считаются.

Фаза включает:
- Bounded context `ChatForge.AI` — HTTP-клиент Req, OpenAI streaming, логирование использования.
- Расширение bounded context `ChatForge.Chat` — Ecto-схемы Conversation и Message, бизнес-логика.
- Phoenix Channel `ChatForgeWeb.ChatChannel` — топик `chat:<conversation_id>`, streaming.
- REST API диалогов (`ChatController`) и публичного лендинга (`ChatInstanceController`).
- React-фронтенд: лендинг чата, список диалогов, интерфейс диалога, WebSocket-хук.

Фаза не включает: подписки и paywall (Phase 5), несколько AI-провайдеров, загрузку файлов в чат.

---

## Архитектура

### Общая схема Phase 4

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              КЛИЕНТЫ                                      │
│                                                                            │
│  Chat SPA (<subdomain>.chatforge.app)                                      │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │  /           │  │  /chat           │  │  /chat/:id               │    │
│  │  Landing     │  │  Conversations   │  │  ConversationPage        │    │
│  │  Page        │  │  Page            │  │  useChat(id) hook        │    │
│  └──────────────┘  └──────────────────┘  └──────────────────────────┘    │
│  API_Client (Axios)          socket.ts (Phoenix JS client)                │
│  endUserAuthStore (Zustand)  chatStore (Zustand)                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTP + WebSocket
              ┌────────────────┴────────────────────┐
              │           PHOENIX APPLICATION        │
              │                                      │
              │  Router                              │
              │    /api/v1/chat/instance             │
              │      → ChatInstanceController        │
              │    /api/v1/chat/conversations/*      │
              │      → ChatController                │
              │    ws://…/socket                     │
              │      → ChatChannel (chat:<id>)       │
              │                                      │
              │  ┌──────────────────────────────┐   │
              │  │  ChatForge.Chat              │   │
              │  │  (bounded context)           │   │
              │  │                              │   │
              │  │  Conversation, Message       │   │
              │  │  EndUser (Phase 2)           │   │
              │  │  create_conversation/2       │   │
              │  │  list_conversations/2        │   │
              │  │  get_conversation/3          │   │
              │  │  delete_conversation/2       │   │
              │  │  send_message/3              │   │
              │  │  save_ai_response/3          │   │
              │  │  check_limit/2               │   │
              │  │  increment_usage/1           │   │
              │  │  get_messages/2              │   │
              │  └──────────────┬───────────────┘   │
              │                 │ вызов через API    │
              │  ┌──────────────┴───────────────┐   │
              │  │  ChatForge.AI               │   │
              │  │  (bounded context)           │   │
              │  │                              │   │
              │  │  AIUsageLog                  │   │
              │  │  complete/3 (streaming)      │   │
              │  │  build_messages/2            │   │
              │  │  log_usage/1                 │   │
              │  └──────────────┬───────────────┘   │
              │                 │ HTTP (Req)         │
              │  Phoenix.PubSub │                    │
              └────────────────┬┴────────────────────┘
                               │
          ┌────────────────────┼──────────────┐
          │                    │              │
   ┌──────┴──┐          ┌──────┴───┐   ┌─────┴──────┐
   │PostgreSQL│          │  Redis   │   │  OpenAI    │
   │convs     │          │  tenant  │   │  API       │
   │messages  │          │  cache   │   │  (stream)  │
   │ai_usage  │          └──────────┘   └────────────┘
   └─────────┘
```

### Ключевые архитектурные решения

**1. AI контекст — stateless оркестратор**
`ChatForge.AI` не хранит состояния и не владеет бизнес-данными. Он принимает готовый список
сообщений, вызывает OpenAI API через Req с `stream: true`, вызывает callback для каждого чанка
и возвращает итоговый результат. Логирование в `ai_usage_logs` — побочный эффект, не влияющий
на основной поток.

**2. Chat контекст вызывает AI через публичный API**
`ChatForge.Chat` никогда не обращается к OpenAI напрямую. Только через `AI.complete/3`.
Это соблюдает архитектурные границы и позволяет заменить AI-провайдер без изменения Chat.

**3. Phoenix Channel обрабатывает каждое сообщение в отдельном процессе**
`handle_in("send_message", ...)` запускает `Task.async` для вызова AI. Это позволяет каналу
оставаться отзывчивым во время стриминга и обрабатывать другие события (например, отключение).

**4. Streaming через push-события канала**
Каждый чанк от OpenAI → `push(socket, "message_chunk", %{content: chunk})`.
Завершение → `push(socket, "message_done", %{message_id: id, content: full})`.
Ошибка → `push(socket, "message_error", %{reason: msg})`.

**5. Оптимистичное обновление на фронтенде**
`sendMessage` в `useChat` немедленно добавляет сообщение пользователя в локальный список,
не дожидаясь подтверждения сервера. Это обеспечивает мгновенный отклик UI.

**6. Tenant-изоляция на всех уровнях**
Все запросы к `conversations` и `messages` фильтруются по `chat_instance_id`.
`ChatChannel.join` проверяет, что `conversation.chat_instance_id == conn.assigns.tenant_id`.

---

## Компоненты и интерфейсы

### Backend: ChatForge.AI (публичный API)

```elixir
# Сборка списка сообщений для OpenAI Chat API
# Возвращает [%{role: "system", content: prompt} | messages_as_maps]
AI.build_messages(system_prompt :: String.t(), messages :: [%Message{}])
  → [%{role: String.t(), content: String.t()}]

# Вызов OpenAI с streaming
# callback вызывается для каждого текстового чанка
AI.complete(
  chat_instance_id :: Ecto.UUID.t(),
  conversation_id  :: Ecto.UUID.t(),
  messages         :: [%{role: String.t(), content: String.t()}],
  callback         :: (String.t() -> :ok)
)
  → {:ok, %{content: String.t(), input_tokens: integer(), output_tokens: integer()}}
  | {:error, %{code: integer(), message: String.t()}}
  | {:error, :stream_interrupted}

# Сохранение записи об использовании AI API
AI.log_usage(%{
  chat_instance_id: Ecto.UUID.t(),
  conversation_id:  Ecto.UUID.t(),
  provider:         String.t(),
  model:            String.t(),
  input_tokens:     integer(),
  output_tokens:    integer(),
  cost:             Decimal.t()
})
  → {:ok, %AIUsageLog{}} | {:error, %Ecto.Changeset{}}
```

### Backend: ChatForge.Chat (расширение публичного API)

```elixir
# --- Диалоги ---

# Создать диалог (title = дата создания)
Chat.create_conversation(end_user_id :: Ecto.UUID.t(), tenant_id :: Ecto.UUID.t())
  → {:ok, %Conversation{}} | {:error, :unauthorized} | {:error, %Ecto.Changeset{}}

# Список диалогов пользователя (сортировка: updated_at DESC)
Chat.list_conversations(end_user_id :: Ecto.UUID.t(), tenant_id :: Ecto.UUID.t())
  → [%Conversation{}]

# Получить диалог (проверка владельца и тенанта)
Chat.get_conversation(
  conversation_id :: Ecto.UUID.t(),
  end_user_id     :: Ecto.UUID.t(),
  tenant_id       :: Ecto.UUID.t()
)
  → {:ok, %Conversation{}} | {:error, :not_found}

# Удалить диалог и все сообщения
Chat.delete_conversation(conversation_id :: Ecto.UUID.t(), end_user_id :: Ecto.UUID.t())
  → {:ok, :deleted} | {:error, :not_found}

# --- Сообщения ---

# Сохранить сообщение пользователя (role: "user")
Chat.send_message(
  conversation_id :: Ecto.UUID.t(),
  end_user_id     :: Ecto.UUID.t(),
  content         :: String.t()
)
  → {:ok, %Message{}} | {:error, %Ecto.Changeset{}}

# Сохранить ответ AI (role: "assistant")
Chat.save_ai_response(
  conversation_id :: Ecto.UUID.t(),
  content         :: String.t(),
  tokens_used     :: integer()
)
  → {:ok, %Message{}} | {:error, %Ecto.Changeset{}}

# Получить сообщения с пагинацией (сортировка: inserted_at ASC)
Chat.get_messages(
  conversation_id :: Ecto.UUID.t(),
  params          :: %{page: integer(), per_page: integer()}
)
  → %{messages: [%Message{}], total_count: integer(), has_more: boolean()}

# --- Лимиты ---

# Проверить лимит сообщений
Chat.check_limit(end_user_id :: Ecto.UUID.t(), tenant_id :: Ecto.UUID.t())
  → {:ok, :allowed} | {:error, :limit_reached}

# Атомарно увеличить счётчик использования
Chat.increment_usage(end_user_id :: Ecto.UUID.t())
  → {:ok, %EndUser{}} | {:error, %Ecto.Changeset{}}
```

### Backend: ChatForgeWeb.ChatChannel

```elixir
defmodule ChatForgeWeb.ChatChannel do
  use ChatForgeWeb, :channel

  # Подключение к топику chat:<conversation_id>
  # Проверяет токен End User-а и принадлежность диалога
  def join("chat:" <> conversation_id, %{"token" => token}, socket)
    → {:ok, socket} | {:error, %{reason: "unauthorized"}}

  # Обработка входящего сообщения
  # Запускает Task.async для неблокирующего стриминга
  def handle_in("send_message", %{"content" => content}, socket)
    → {:noreply, socket}

  # Внутренние события от Task (стриминг)
  def handle_info({:ai_chunk, chunk}, socket)   → push "message_chunk"
  def handle_info({:ai_done, result}, socket)   → push "message_done"
  def handle_info({:ai_error, reason}, socket)  → push "message_error"
end
```

### Backend: ChatForgeWeb.ChatController

```elixir
# GET /api/v1/chat/conversations
def index(conn, _params)
  → JSON 200: %{conversations: [...]}

# POST /api/v1/chat/conversations
def create(conn, _params)
  → JSON 201: %{conversation: {...}}

# DELETE /api/v1/chat/conversations/:id
def delete(conn, %{"id" => id})
  → JSON 200: %{ok: true} | JSON 404

# GET /api/v1/chat/conversations/:id/messages
def messages(conn, %{"id" => id, "page" => page, "per_page" => per_page})
  → JSON 200: %{messages: [...], total_count: n, has_more: bool, page: n, per_page: n}
```

### Backend: ChatForgeWeb.ChatInstanceController

```elixir
# GET /api/v1/chat/instance
# Публичный эндпоинт — не требует аутентификации
def show(conn, _params)
  → JSON 200: %{instance: {name, primary_color, secondary_color,
                            background_color, avatar_url,
                            greeting_text, example_questions}}
  | JSON 404
```

### Backend: Дополнение роутера

```elixir
# Публичный эндпоинт лендинга (только TenantResolver)
scope "/api/v1/chat", ChatForgeWeb do
  pipe_through [:api, :chat_tenant]
  get "/instance", ChatInstanceController, :show
end

# REST API диалогов (TenantResolver + AuthRequired)
scope "/api/v1/chat", ChatForgeWeb do
  pipe_through [:api, :chat_tenant, :authenticated]
  get    "/conversations",                  ChatController, :index
  post   "/conversations",                  ChatController, :create
  delete "/conversations/:id",              ChatController, :delete
  get    "/conversations/:id/messages",     ChatController, :messages
end

# WebSocket endpoint (уже существует в Phoenix по умолчанию)
# socket "/socket", ChatForgeWeb.UserSocket
# channel "chat:*", ChatForgeWeb.ChatChannel
```

### Frontend: Структура файлов

```
frontend/src/
├── features/chat/
│   ├── api.ts                    # Типизированные функции для chat-эндпоинтов
│   ├── chatStore.ts              # Zustand Chat Store
│   ├── types.ts                  # Conversation, Message, InstanceInfo
│   └── hooks/
│       └── useChat.ts            # Хук управления ChatChannel
├── shared/lib/
│   └── socket.ts                 # Phoenix Socket (singleton)
├── pages/chat/
│   ├── landing/
│   │   └── ChatLandingPage.tsx   # Страница / (лендинг чата)
│   ├── conversations/
│   │   └── ConversationsPage.tsx # Страница /chat (список диалогов)
│   └── conversation/
│       └── ConversationPage.tsx  # Страница /chat/:id (интерфейс диалога)
└── app/
    └── App.tsx                   # Обновлённый роутинг с chat-маршрутами
```

### Frontend: socket.ts

```typescript
// src/shared/lib/socket.ts
import { Socket } from "phoenix";
import { useEndUserAuthStore } from "@/features/auth/endUserAuthStore";

// Singleton Phoenix Socket
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useEndUserAuthStore.getState().accessToken;
    socket = new Socket(import.meta.env.VITE_WS_URL, {
      params: { token },
    });
  }
  return socket;
}

// Подключить сокет (вызывается при логине End User-а)
export function connectSocket(): void {
  getSocket().connect();
}

// Отключить сокет (вызывается при логауте)
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
```

### Frontend: useChat хук

```typescript
// src/features/chat/hooks/useChat.ts
interface UseChatReturn {
  messages: Message[];
  sendMessage: (content: string) => void;
  isStreaming: boolean;
  error: string | null;
}

export function useChat(conversationId: string): UseChatReturn {
  // При монтировании: подключается к каналу chat:<conversationId>
  // Подписывается на: message_chunk, message_done, message_error, limit_reached
  // При размонтировании: покидает канал (channel.leave())
  // sendMessage: оптимистично добавляет сообщение, отправляет событие send_message
  // message_chunk: добавляет текст к стримящемуся сообщению ассистента
  // message_done: заменяет стримящееся сообщение финальным, isStreaming = false
  // message_error: устанавливает error, показывает toast через Sonner
  // limit_reached: устанавливает флаг для отображения paywall-заглушки
}
```

### Frontend: Zustand Chat Store

```typescript
// src/features/chat/chatStore.ts
interface ChatState {
  // Список диалогов
  conversations: Conversation[];
  conversationsLoading: boolean;

  // Текущие сообщения (для открытого диалога)
  messages: Message[];
  messagesLoading: boolean;

  // Данные инстанса (лендинг)
  instanceInfo: InstanceInfo | null;
  instanceLoading: boolean;

  // Методы
  fetchConversations: () => Promise<void>;
  createConversation: () => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  fetchMessages: (conversationId: string, page?: number) => Promise<void>;
  fetchInstanceInfo: () => Promise<void>;
  addMessage: (message: Message) => void;
  updateStreamingMessage: (chunk: string) => void;
  finalizeStreamingMessage: (messageId: string, content: string) => void;
  reset: () => void;
}
```

### Frontend: Страницы

**ChatLandingPage (`/`)**
- При монтировании: `chatStore.fetchInstanceInfo()`.
- Отображает: аватар AI, название, greeting_text, example_questions (кнопки).
- Кнопка "Начать чат": если аутентифицирован → `/chat`, иначе → `/chat/login`.
- Клик на пример вопроса → `/chat/login?question=<encoded>`.
- Skeleton-загрузчик пока данные загружаются.

**ConversationsPage (`/chat`)**
- Защищённый маршрут (только для аутентифицированных End User-ов).
- При монтировании: `chatStore.fetchConversations()`.
- Список диалогов с заголовком, временем обновления, кнопкой удаления.
- Кнопка "Новый диалог" → `createConversation()` → navigate `/chat/:id`.
- Пустое состояние с иллюстрацией.
- Skeleton-загрузчик.

**ConversationPage (`/chat/:id`)**
- Защищённый маршрут.
- При монтировании: `chatStore.fetchMessages(id)` + `useChat(id)`.
- Пузыри сообщений: user — справа, assistant — слева с аватаром.
- Markdown-рендеринг ответов ассистента через `react-markdown`.
- Поле ввода: Enter → отправить, Shift+Enter → перенос строки.
- Индикатор "печатает..." во время стриминга.
- Автоскролл вниз при новых сообщениях/чанках.
- Paywall-заглушка при `limit_reached`.
- Toast-уведомление при `message_error` через Sonner.

---

## Модели данных

### Ecto-схема: ChatForge.Chat.Conversation

```elixir
schema "conversations" do
  field :title,            :string

  belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
             foreign_key: :chat_instance_id
  belongs_to :end_user,    ChatForge.Chat.EndUser

  timestamps()
end

def changeset(conversation, attrs) do
  conversation
  |> cast(attrs, [:chat_instance_id, :end_user_id, :title])
  |> validate_required([:chat_instance_id, :end_user_id])
  |> validate_length(:title, max: 255)
  |> foreign_key_constraint(:chat_instance_id)
  |> foreign_key_constraint(:end_user_id)
end
```

### Ecto-схема: ChatForge.Chat.Message

```elixir
schema "messages" do
  field :role,        :string
  field :content,     :string
  field :tokens_used, :integer, default: 0

  belongs_to :conversation,  ChatForge.Chat.Conversation
  belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
             foreign_key: :chat_instance_id

  # Нет updated_at — сообщения иммутабельны
  timestamps(updated_at: false)
end

def changeset(message, attrs) do
  message
  |> cast(attrs, [:conversation_id, :chat_instance_id, :role, :content, :tokens_used])
  |> validate_required([:conversation_id, :chat_instance_id, :role, :content])
  |> validate_inclusion(:role, ["user", "assistant"])
  |> validate_length(:content, min: 1)
  |> validate_change(:content, fn :content, val ->
    if String.trim(val) == "", do: [content: "can't be blank"], else: []
  end)
  |> foreign_key_constraint(:conversation_id)
  |> foreign_key_constraint(:chat_instance_id)
end
```

### Ecto-схема: ChatForge.AI.AIUsageLog

```elixir
schema "ai_usage_logs" do
  field :provider,       :string
  field :model,          :string
  field :input_tokens,   :integer
  field :output_tokens,  :integer
  field :cost,           :decimal

  belongs_to :chat_instance, ChatForge.Instances.ChatInstance,
             foreign_key: :chat_instance_id
  belongs_to :conversation,  ChatForge.Chat.Conversation

  # Только inserted_at — логи иммутабельны
  timestamps(updated_at: false)
end

def changeset(log, attrs) do
  log
  |> cast(attrs, [:chat_instance_id, :conversation_id, :provider,
                  :model, :input_tokens, :output_tokens, :cost])
  |> validate_required([:chat_instance_id, :conversation_id, :provider,
                        :model, :input_tokens, :output_tokens, :cost])
  |> validate_inclusion(:provider, ["openai"])
  |> validate_number(:input_tokens, greater_than_or_equal_to: 0)
  |> validate_number(:output_tokens, greater_than_or_equal_to: 0)
end
```

### Миграции SQL

```sql
-- Миграция 1: conversations
CREATE TABLE conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id) ON DELETE CASCADE,
  end_user_id      UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  title            VARCHAR(255),
  inserted_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_end_user_id      ON conversations(end_user_id);
CREATE INDEX idx_conversations_chat_instance_id ON conversations(chat_instance_id);
CREATE INDEX idx_conversations_updated_at       ON conversations(updated_at DESC);

-- Миграция 2: messages
CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  tokens_used      INTEGER NOT NULL DEFAULT 0,
  inserted_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id  ON messages(conversation_id);
CREATE INDEX idx_messages_chat_instance_id ON messages(chat_instance_id);
CREATE INDEX idx_messages_inserted_at      ON messages(inserted_at ASC);

-- Миграция 3: ai_usage_logs
CREATE TABLE ai_usage_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_instance_id UUID NOT NULL REFERENCES chat_instances(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  provider         VARCHAR(50) NOT NULL,
  model            VARCHAR(100) NOT NULL,
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  cost             DECIMAL(10, 6) NOT NULL DEFAULT 0,
  inserted_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_chat_instance_id ON ai_usage_logs(chat_instance_id);
CREATE INDEX idx_ai_usage_logs_conversation_id  ON ai_usage_logs(conversation_id);
CREATE INDEX idx_ai_usage_logs_inserted_at      ON ai_usage_logs(inserted_at DESC);
```

### API Response форматы

**GET /api/v1/chat/instance:**
```json
{
  "instance": {
    "name": "Мой AI-ассистент",
    "primary_color": "#6366F1",
    "secondary_color": "#8B5CF6",
    "background_color": "#F8FAFC",
    "avatar_url": "https://s3.example.com/avatars/uuid.jpg",
    "greeting_text": "Привет! Чем могу помочь?",
    "example_questions": ["Что ты умеешь?", "Как начать?"]
  }
}
```

**GET /api/v1/chat/conversations:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "Диалог от 15 января 2025",
      "inserted_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

**POST /api/v1/chat/conversations (201):**
```json
{
  "conversation": {
    "id": "uuid",
    "title": "Диалог от 15 января 2025",
    "inserted_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
}
```

**GET /api/v1/chat/conversations/:id/messages:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Привет!",
      "tokens_used": 0,
      "inserted_at": "2025-01-15T10:00:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Привет! Чем могу помочь?",
      "tokens_used": 42,
      "inserted_at": "2025-01-15T10:00:05Z"
    }
  ],
  "total_count": 2,
  "has_more": false,
  "page": 1,
  "per_page": 50
}
```

**WebSocket события (ChatChannel):**
```json
// Клиент → сервер
{ "event": "send_message", "payload": { "content": "Привет!" } }

// Сервер → клиент (стриминг)
{ "event": "message_chunk", "payload": { "content": "При" } }
{ "event": "message_chunk", "payload": { "content": "вет" } }
{ "event": "message_done",  "payload": { "message_id": "uuid", "content": "Привет!" } }

// Ошибки
{ "event": "message_error",  "payload": { "reason": "AI service unavailable" } }
{ "event": "limit_reached",  "payload": {} }
```

---

## Свойства корректности

*Свойство — это характеристика или поведение, которое должно выполняться при всех допустимых
выполнениях системы. По сути, это формальное утверждение о том, что система должна делать.
Свойства служат мостом между читаемыми человеком спецификациями и машинно-верифицируемыми
гарантиями корректности.*

### Свойство 1: Инвариант tenant-изоляции диалогов

*Для любых* двух End User-ов `A` и `B`, принадлежащих разным тенантам (`A.chat_instance_id ≠ B.chat_instance_id`):
`Chat.list_conversations(A.id, A.tenant_id)` никогда не должен содержать диалоги, где
`chat_instance_id == B.tenant_id`. Аналогично, `Chat.get_conversation(conv_id, A.id, A.tenant_id)`
должен возвращать `{:error, :not_found}` для любого `conv_id`, принадлежащего тенанту B.

**Validates: Requirements 4.2, 4.5, 5.7, 7.8**

### Свойство 2: Round-trip — создание и получение диалога

*Для любого* валидного `end_user_id` и `tenant_id`: если `Chat.create_conversation/2` вернул
`{:ok, conv}`, то `Chat.get_conversation(conv.id, end_user_id, tenant_id)` должен вернуть
`{:ok, conversation}` с теми же `id` и `chat_instance_id`.

**Validates: Requirements 4.1, 4.4**

### Свойство 3: Инвариант каскадного удаления сообщений

*Для любого* `conversation_id` с произвольным количеством сообщений: после успешного вызова
`Chat.delete_conversation/2` вызов `Chat.get_messages(conversation_id, %{page: 1, per_page: 100})`
должен возвращать `%{messages: [], total_count: 0, has_more: false}`.

**Validates: Requirements 4.6**

### Свойство 4: Инвариант счётчика сообщений

*Для любого* `end_user_id` с начальным значением `messages_used = N`: после K успешных вызовов
`Chat.increment_usage/1` значение `EndUser.messages_used` должно быть равно `N + K`.

**Validates: Requirements 5.4**

### Свойство 5: Инвариант порядка сообщений

*Для любого* `conversation_id` с произвольным набором сообщений: список, возвращаемый
`Chat.get_messages/2`, должен быть отсортирован по `inserted_at` по возрастанию — то есть
для любых двух соседних элементов `messages[i].inserted_at <= messages[i+1].inserted_at`.

**Validates: Requirements 4.8**

### Свойство 6: Инвариант роли сообщения

*Для любого* вызова `Chat.send_message/3`, возвращающего `{:ok, message}`: `message.role`
должен быть `"user"`. *Для любого* вызова `Chat.save_ai_response/3`, возвращающего
`{:ok, message}`: `message.role` должен быть `"assistant"`.

**Validates: Requirements 5.1, 5.5**

### Свойство 7: Round-trip — сборка сообщений для AI

*Для любого* `system_prompt` и любого списка `Message`-структур `msgs`:
`AI.build_messages(system_prompt, msgs)` должен вернуть список, где:
- первый элемент: `%{role: "system", content: system_prompt}`,
- остальные элементы соответствуют `msgs` в том же порядке с сохранёнными `role` и `content`,
- длина результата равна `length(msgs) + 1`.

**Validates: Requirements 1.3**

### Свойство 8: Идемпотентность проверки лимита

*Для любого* `end_user_id` и `tenant_id`: повторный вызов `Chat.check_limit/2` без изменения
`EndUser.messages_used` должен возвращать тот же результат — либо `{:ok, :allowed}`, либо
`{:error, :limit_reached}`.

**Validates: Requirements 5.3**

### Свойство 9: Инвариант валидации changeset Message

*Для любой* строки `role`, не входящей в `["user", "assistant"]`: changeset `Message` должен
быть невалидным с ошибкой на поле `role`. *Для любой* строки `content`, состоящей только из
пробельных символов или пустой: changeset `Message` должен быть невалидным с ошибкой на поле
`content`.

**Validates: Requirements 3.4, 3.5, 3.6**

### Свойство 10: Логирование использования AI после успешного вызова

*Для любого* успешного вызова `AI.complete/3` с `chat_instance_id` и `conversation_id`:
в таблице `ai_usage_logs` должна появиться запись с теми же `chat_instance_id` и
`conversation_id`, где `input_tokens + output_tokens > 0` и `cost >= 0`.

**Validates: Requirements 2.2, 2.3**

### Свойство 11: Изоляция диалогов в ChatChannel

*Для любого* End User-а и любого `conversation_id`, не принадлежащего этому End User-у или
принадлежащего другому тенанту: попытка подключиться к каналу `chat:<conversation_id>` должна
возвращать `{:error, %{reason: "unauthorized"}}`.

**Validates: Requirements 6.1, 6.2**

### Свойство 12: Порядок диалогов по updated_at

*Для любого* `end_user_id` с произвольным набором диалогов: список, возвращаемый
`Chat.list_conversations/2`, должен быть отсортирован по `updated_at` по убыванию — то есть
для любых двух соседних элементов `convs[i].updated_at >= convs[i+1].updated_at`.

**Validates: Requirements 4.3**

---

## Обработка ошибок

### Backend: стратегия ответов

Все ошибки возвращаются в едином JSON-формате (унаследован из Phase 2/3):

```json
// Ошибки валидации (HTTP 422)
{ "errors": { "field": ["message"] } }

// Бизнес-ошибки (HTTP 422)
{ "error": "limit_reached" }

// Не найдено (HTTP 404)
{ "error": "not_found" }

// Не авторизован (HTTP 401)
{ "error": "unauthorized" }
```

### Обработка ошибок по компонентам

**ChatForge.AI.complete/3:**
- HTTP 4xx/5xx от OpenAI → `{:error, %{code: status, message: body}}`.
- Разрыв соединения во время стриминга → `{:error, :stream_interrupted}`.
- Ошибка сохранения `AIUsageLog` → `Logger.error/1`, основной поток не прерывается.

**ChatForge.Chat.send_message/3:**
- Пустой `content` → `{:error, changeset}` → HTTP 422.
- Несуществующий `conversation_id` → ошибка FK → `{:error, changeset}` → HTTP 422.

**ChatForge.Chat.check_limit/2:**
- `messages_used >= free_messages_limit` → `{:error, :limit_reached}`.
- `free_messages_limit == nil` (безлимитный) → `{:ok, :allowed}`.

**ChatForgeWeb.ChatChannel:**
- Невалидный токен при `join` → `{:error, %{reason: "unauthorized"}}`.
- `check_limit` вернул `:limit_reached` → `push(socket, "limit_reached", %{})`, не вызывать AI.
- `AI.complete/3` вернул ошибку → `push(socket, "message_error", %{reason: msg})`, не сохранять.
- Task упал с исключением → `push(socket, "message_error", %{reason: "internal_error"})`.

**ChatForgeWeb.ChatController:**
- `{:error, :not_found}` → HTTP 404.
- `{:error, :unauthorized}` → HTTP 401.
- `{:error, changeset}` → HTTP 422 с полями ошибок.

**ChatForgeWeb.ChatInstanceController:**
- Тенант не найден (TenantResolver) → HTTP 404 (обрабатывается Plug-ом).

**Frontend:**
- `message_error` → toast через Sonner с текстом ошибки.
- `limit_reached` → отображение paywall-заглушки, блокировка поля ввода.
- HTTP 401 от REST API → интерцептор Axios пытается refresh, при неудаче → редирект на `/chat/login`.
- Ошибка загрузки данных инстанса → сообщение об ошибке вместо лендинга.
- Разрыв WebSocket → Phoenix JS client автоматически переподключается с экспоненциальной задержкой.

---

## Стратегия тестирования

### Подход

**Два уровня тестов:**
- **Unit/Integration тесты** — конкретные примеры: HTTP-статусы, структуры ответов, граничные случаи.
- **Property-based тесты** — универсальные свойства: корректность для любых валидных/невалидных входных данных.

Unit-тесты фокусируются на конкретных примерах и интеграционных точках.
Property-тесты покрывают широкий диапазон входных данных через рандомизацию.

### Backend: Property-based тесты (StreamData)

Библиотека: [`stream_data`](https://hex.pm/packages/stream_data).
Минимум 100 итераций на каждый property-тест.

```elixir
# Feature: chatforge-phase-4, Property 1: tenant isolation invariant
property "list_conversations не возвращает диалоги другого тенанта" do
  check all _seed <- StreamData.constant(:ok), max_runs: 100 do
    # Создаём два инстанса и двух End User-ов
    instance_a = insert_chat_instance()
    instance_b = insert_chat_instance()
    user_a = insert_end_user(instance_a.id)
    user_b = insert_end_user(instance_b.id)

    # Создаём диалоги для каждого
    {:ok, _conv_a} = Chat.create_conversation(user_a.id, instance_a.id)
    {:ok, _conv_b} = Chat.create_conversation(user_b.id, instance_b.id)

    # Проверяем изоляцию
    convs_a = Chat.list_conversations(user_a.id, instance_a.id)
    assert Enum.all?(convs_a, &(&1.chat_instance_id == instance_a.id))
    refute Enum.any?(convs_a, &(&1.chat_instance_id == instance_b.id))
  end
end

# Feature: chatforge-phase-4, Property 2: create then get round-trip
property "create_conversation затем get_conversation возвращает тот же диалог" do
  check all _seed <- StreamData.constant(:ok), max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)

    {:ok, conv} = Chat.create_conversation(user.id, instance.id)
    assert {:ok, found} = Chat.get_conversation(conv.id, user.id, instance.id)
    assert found.id == conv.id
    assert found.chat_instance_id == instance.id
  end
end

# Feature: chatforge-phase-4, Property 3: cascade delete messages
property "delete_conversation удаляет все сообщения диалога" do
  check all msg_count <- StreamData.integer(1..20), max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)
    {:ok, conv} = Chat.create_conversation(user.id, instance.id)

    # Добавляем случайное количество сообщений
    for _ <- 1..msg_count do
      Chat.send_message(conv.id, user.id, "тест")
    end

    {:ok, :deleted} = Chat.delete_conversation(conv.id, user.id)
    result = Chat.get_messages(conv.id, %{page: 1, per_page: 100})
    assert result.messages == []
    assert result.total_count == 0
  end
end

# Feature: chatforge-phase-4, Property 4: messages_used counter invariant
property "increment_usage увеличивает messages_used ровно на N" do
  check all n <- StreamData.integer(1..50), max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)
    initial = user.messages_used

    for _ <- 1..n do
      {:ok, _} = Chat.increment_usage(user.id)
    end

    updated = Repo.get!(EndUser, user.id)
    assert updated.messages_used == initial + n
  end
end

# Feature: chatforge-phase-4, Property 5: messages chronological order
property "get_messages возвращает сообщения в хронологическом порядке" do
  check all msg_count <- StreamData.integer(2..30), max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)
    {:ok, conv} = Chat.create_conversation(user.id, instance.id)

    for i <- 1..msg_count do
      Chat.send_message(conv.id, user.id, "сообщение #{i}")
    end

    result = Chat.get_messages(conv.id, %{page: 1, per_page: 100})
    timestamps = Enum.map(result.messages, & &1.inserted_at)
    assert timestamps == Enum.sort(timestamps, DateTime)
  end
end

# Feature: chatforge-phase-4, Property 6: message role invariant
property "send_message всегда создаёт сообщение с role: user" do
  check all content <- StreamData.string(:alphanumeric, min_length: 1),
            max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)
    {:ok, conv} = Chat.create_conversation(user.id, instance.id)

    {:ok, msg} = Chat.send_message(conv.id, user.id, content)
    assert msg.role == "user"
  end
end

property "save_ai_response всегда создаёт сообщение с role: assistant" do
  check all content <- StreamData.string(:alphanumeric, min_length: 1),
            tokens  <- StreamData.integer(0..10_000),
            max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)
    {:ok, conv} = Chat.create_conversation(user.id, instance.id)

    {:ok, msg} = Chat.save_ai_response(conv.id, content, tokens)
    assert msg.role == "assistant"
  end
end

# Feature: chatforge-phase-4, Property 7: build_messages round-trip
property "build_messages сохраняет порядок и роли сообщений" do
  check all system_prompt <- StreamData.string(:alphanumeric, min_length: 1),
            msgs <- StreamData.list_of(
              StreamData.fixed_map(%{
                role:    StreamData.member_of(["user", "assistant"]),
                content: StreamData.string(:alphanumeric, min_length: 1)
              }),
              min_length: 0,
              max_length: 20
            ),
            max_runs: 100 do
    result = AI.build_messages(system_prompt, msgs)

    # Первый элемент — system prompt
    assert hd(result) == %{role: "system", content: system_prompt}

    # Остальные — сообщения в том же порядке
    rest = tl(result)
    assert length(rest) == length(msgs)
    Enum.zip(rest, msgs) |> Enum.each(fn {built, original} ->
      assert built.role == original.role
      assert built.content == original.content
    end)
  end
end

# Feature: chatforge-phase-4, Property 8: check_limit idempotency
property "check_limit возвращает одинаковый результат при повторном вызове" do
  check all _seed <- StreamData.constant(:ok), max_runs: 100 do
    instance = insert_chat_instance_with_limit(10)
    user = insert_end_user(instance.id)

    result1 = Chat.check_limit(user.id, instance.id)
    result2 = Chat.check_limit(user.id, instance.id)
    assert result1 == result2
  end
end

# Feature: chatforge-phase-4, Property 9: message changeset validation
property "changeset Message невалиден для role вне [user, assistant]" do
  check all role <- StreamData.string(:alphanumeric)
                    |> StreamData.filter(&(&1 not in ["user", "assistant"])),
            max_runs: 100 do
    changeset = Message.changeset(%Message{}, %{
      conversation_id:  Ecto.UUID.generate(),
      chat_instance_id: Ecto.UUID.generate(),
      role:             role,
      content:          "тест"
    })
    refute changeset.valid?
    assert Keyword.has_key?(changeset.errors, :role)
  end
end

property "changeset Message невалиден для пустого или пробельного content" do
  check all content <- StreamData.string_of(StreamData.member_of([" ", "\t", "\n"]),
                                            min_length: 0, max_length: 20),
            max_runs: 100 do
    changeset = Message.changeset(%Message{}, %{
      conversation_id:  Ecto.UUID.generate(),
      chat_instance_id: Ecto.UUID.generate(),
      role:             "user",
      content:          content
    })
    refute changeset.valid?
    assert Keyword.has_key?(changeset.errors, :content)
  end
end

# Feature: chatforge-phase-4, Property 10: AI usage logging
property "AI.complete/3 создаёт запись ai_usage_logs при успехе" do
  check all _seed <- StreamData.constant(:ok), max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)
    {:ok, conv} = Chat.create_conversation(user.id, instance.id)

    messages = [%{role: "user", content: "тест"}]
    {:ok, result} = AI.complete(instance.id, conv.id, messages, fn _chunk -> :ok end)

    log = Repo.get_by!(AIUsageLog,
      chat_instance_id: instance.id,
      conversation_id: conv.id
    )
    assert log.input_tokens + log.output_tokens > 0
    assert Decimal.compare(log.cost, Decimal.new(0)) in [:gt, :eq]
    assert result.content != ""
  end
end

# Feature: chatforge-phase-4, Property 11: channel auth isolation
property "ChatChannel отклоняет подключение к чужому диалогу" do
  check all _seed <- StreamData.constant(:ok), max_runs: 100 do
    instance_a = insert_chat_instance()
    instance_b = insert_chat_instance()
    user_a = insert_end_user(instance_a.id)
    user_b = insert_end_user(instance_b.id)

    {:ok, conv_b} = Chat.create_conversation(user_b.id, instance_b.id)
    token_a = generate_token(user_a)

    # User A пытается подключиться к диалогу User B
    assert {:error, %{reason: "unauthorized"}} =
      ChatChannel.join("chat:#{conv_b.id}", %{"token" => token_a}, mock_socket(instance_a.id))
  end
end

# Feature: chatforge-phase-4, Property 12: conversations sorted by updated_at desc
property "list_conversations возвращает диалоги отсортированные по updated_at desc" do
  check all count <- StreamData.integer(2..10), max_runs: 100 do
    instance = insert_chat_instance()
    user = insert_end_user(instance.id)

    for _ <- 1..count do
      Chat.create_conversation(user.id, instance.id)
      Process.sleep(1) # гарантируем разные timestamps
    end

    convs = Chat.list_conversations(user.id, instance.id)
    timestamps = Enum.map(convs, & &1.updated_at)
    assert timestamps == Enum.sort(timestamps, {:desc, DateTime})
  end
end
```

### Backend: Unit/Integration тесты (ExUnit)

```elixir
# ChatForge.AI
describe "AI.build_messages/2" do
  test "первый элемент всегда system prompt"
  test "пустой список сообщений → только system prompt"
  test "сохраняет role и content каждого сообщения"
end

describe "AI.complete/3" do
  test "возвращает {:ok, result} с content и токенами при успехе (mock OpenAI)"
  test "возвращает {:error, %{code: 401}} при невалидном API ключе"
  test "возвращает {:error, :stream_interrupted} при разрыве соединения"
  test "вызывает callback для каждого чанка"
end

# ChatForge.Chat
describe "Chat.create_conversation/2" do
  test "создаёт диалог с автоматическим title (дата)"
  test "возвращает {:error, :unauthorized} для end_user из другого тенанта"
end

describe "Chat.delete_conversation/2" do
  test "возвращает {:error, :not_found} для чужого диалога"
  test "возвращает {:ok, :deleted} для своего диалога"
end

describe "Chat.check_limit/2" do
  test "возвращает {:ok, :allowed} если messages_used < limit"
  test "возвращает {:error, :limit_reached} если messages_used >= limit"
  test "возвращает {:ok, :allowed} если limit == nil (безлимитный)"
end

# ChatController
describe "GET /api/v1/chat/conversations" do
  test "возвращает 200 со списком диалогов"
  test "возвращает 401 без токена"
  test "не возвращает диалоги другого тенанта"
end

describe "POST /api/v1/chat/conversations" do
  test "возвращает 201 с данными нового диалога"
  test "возвращает 401 без токена"
end

describe "DELETE /api/v1/chat/conversations/:id" do
  test "возвращает 200 для своего диалога"
  test "возвращает 404 для чужого диалога"
end

describe "GET /api/v1/chat/conversations/:id/messages" do
  test "возвращает 200 с пагинированными сообщениями"
  test "возвращает 404 для чужого диалога"
  test "метаданные пагинации корректны (total_count, has_more)"
end

# ChatInstanceController
describe "GET /api/v1/chat/instance" do
  test "возвращает 200 с публичными данными инстанса"
  test "не возвращает system_prompt и creator_id"
  test "возвращает 404 при некорректном поддомене (через TenantResolver)"
  test "не требует аутентификации"
end

# ChatChannel
describe "ChatChannel join" do
  test "успешное подключение с валидным токеном и своим диалогом"
  test "отклонение с невалидным токеном"
  test "отклонение с чужим диалогом"
end

describe "ChatChannel send_message" do
  test "отправляет message_chunk события во время стриминга"
  test "отправляет message_done по завершении"
  test "отправляет limit_reached если лимит исчерпан"
  test "отправляет message_error при ошибке AI"
end
```

### Frontend: тесты (Vitest + Testing Library)

```typescript
// Feature: chatforge-phase-4, Property 7: build_messages structure
// (тестируется на backend, на frontend — интеграционный тест useChat)

// useChat hook
test('useChat подключается к каналу при монтировании', () => {
  // Мокаем Phoenix Socket, проверяем что channel.join вызван
})

test('useChat отключается от канала при размонтировании', () => {
  // Проверяем что channel.leave вызван
})

test('useChat добавляет сообщение оптимистично при sendMessage', () => {
  // Вызываем sendMessage, проверяем что messages обновился до ответа сервера
})

test('useChat обновляет стримящееся сообщение при message_chunk', () => {
  // Симулируем события message_chunk, проверяем накопление текста
})

test('useChat финализирует сообщение при message_done', () => {
  // Симулируем message_done, проверяем isStreaming = false
})

// ChatLandingPage
test('ChatLandingPage отображает skeleton во время загрузки', () => {})
test('ChatLandingPage отображает данные инстанса после загрузки', () => {})
test('ChatLandingPage показывает ошибку при неудачном запросе', () => {})

// ConversationsPage
test('ConversationsPage перенаправляет неаутентифицированного пользователя', () => {})
test('ConversationsPage отображает пустое состояние при отсутствии диалогов', () => {})

// ConversationPage
test('ConversationPage рендерит markdown в сообщениях ассистента', () => {})
test('ConversationPage блокирует ввод во время стриминга', () => {})
test('ConversationPage показывает paywall при limit_reached', () => {})
```

### Запуск тестов

```bash
# Backend (одиночный запуск)
mix test

# Frontend (одиночный запуск)
cd frontend && npx vitest --run
```
