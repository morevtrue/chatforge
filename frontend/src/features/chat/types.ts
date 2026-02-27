// Типы для AI-чата (диалоги, сообщения, инстанс)

export interface Conversation {
  id: string
  title: string
  inserted_at: string
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  tokens_used: number
  inserted_at: string
  // Флаг для оптимистичных/стриминговых сообщений (не приходит с сервера)
  isStreaming?: boolean
}

export interface InstanceInfo {
  id: string
  name: string
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  avatar_url: string | null
  greeting_text: string | null
  example_questions: string[]
}
