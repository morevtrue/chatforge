// Типизированные API-функции для чата
// Используют общий axios-инстанс из shared/lib/api.ts

import { api } from '@/shared/lib/api'
import type { Conversation, Message, InstanceInfo } from './types'

// -------------------------------------------------------------------------
// Инстанс
// -------------------------------------------------------------------------

export async function fetchInstanceInfo(): Promise<InstanceInfo> {
  const { data } = await api.get<{ instance: InstanceInfo }>('/api/v1/chat/instance')
  return data.instance
}

// -------------------------------------------------------------------------
// Диалоги
// -------------------------------------------------------------------------

export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await api.get<{ conversations: Conversation[] }>('/api/v1/chat/conversations')
  return data.conversations
}

export async function createConversation(): Promise<Conversation> {
  const { data } = await api.post<{ conversation: Conversation }>('/api/v1/chat/conversations')
  return data.conversation
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/api/v1/chat/conversations/${id}`)
}

// -------------------------------------------------------------------------
// Сообщения
// -------------------------------------------------------------------------

interface MessagesResponse {
  messages: Message[]
  total_count: number
  has_more: boolean
  page: number
  per_page: number
}

export async function fetchMessages(
  conversationId: string,
  page = 1,
  perPage = 50
): Promise<MessagesResponse> {
  const { data } = await api.get<MessagesResponse>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    { params: { page, per_page: perPage } }
  )
  return data
}
