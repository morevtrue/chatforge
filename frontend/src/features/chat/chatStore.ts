// Zustand-стор для AI-чата
// Управляет диалогами, сообщениями, инфо об инстансе и стримингом

import { create } from 'zustand'
import * as chatApi from './api'
import type { Conversation, Message, InstanceInfo } from './types'

// ID временного стримингового сообщения
const STREAMING_MSG_ID = '__streaming__'

interface ChatState {
  // Диалоги
  conversations: Conversation[]
  conversationsLoading: boolean
  conversationsError: string | null

  // Сообщения текущего диалога
  messages: Message[]
  messagesLoading: boolean
  messagesError: string | null

  // Инфо об инстансе
  instanceInfo: InstanceInfo | null
  instanceLoading: boolean

  // Методы
  fetchConversations: () => Promise<void>
  createConversation: () => Promise<Conversation>
  deleteConversation: (id: string) => Promise<void>
  fetchMessages: (conversationId: string, page?: number, perPage?: number) => Promise<void>
  fetchInstanceInfo: () => Promise<void>

  // Стриминг
  addMessage: (message: Message) => void
  updateStreamingMessage: (chunk: string) => void
  finalizeStreamingMessage: (id: string, content: string) => void

  reset: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  conversationsLoading: false,
  conversationsError: null,
  messages: [],
  messagesLoading: false,
  messagesError: null,
  instanceInfo: null,
  instanceLoading: false,

  fetchConversations: async () => {
    set({ conversationsLoading: true, conversationsError: null })
    try {
      const conversations = await chatApi.fetchConversations()
      set({ conversations })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки диалогов'
      set({ conversationsError: msg })
    } finally {
      set({ conversationsLoading: false })
    }
  },

  createConversation: async () => {
    const conversation = await chatApi.createConversation()
    set((s) => ({ conversations: [conversation, ...s.conversations] }))
    return conversation
  },

  deleteConversation: async (id) => {
    await chatApi.deleteConversation(id)
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }))
  },

  fetchMessages: async (conversationId, page = 1, perPage = 50) => {
    set({ messagesLoading: true, messagesError: null })
    try {
      const { messages } = await chatApi.fetchMessages(conversationId, page, perPage)
      set({ messages })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки сообщений'
      set({ messagesError: msg })
    } finally {
      set({ messagesLoading: false })
    }
  },

  fetchInstanceInfo: async () => {
    set({ instanceLoading: true })
    try {
      const instanceInfo = await chatApi.fetchInstanceInfo()
      set({ instanceInfo })
    } catch (e) {
      console.error('[chatStore] fetchInstanceInfo error:', e)
    } finally {
      set({ instanceLoading: false })
    }
  },

  // Добавляет сообщение (оптимистично или финальное)
  addMessage: (message) => {
    set((s) => ({ messages: [...s.messages, message] }))
  },

  // Добавляет чанк к стриминговому сообщению ассистента
  // Если стримингового сообщения нет — создаёт его
  updateStreamingMessage: (chunk) => {
    set((s) => {
      const existing = s.messages.find((m) => m.id === STREAMING_MSG_ID)
      if (existing) {
        return {
          messages: s.messages.map((m) =>
            m.id === STREAMING_MSG_ID ? { ...m, content: m.content + chunk } : m
          ),
        }
      }
      // Создаём новое стриминговое сообщение
      const streamingMsg: Message = {
        id: STREAMING_MSG_ID,
        role: 'assistant',
        content: chunk,
        tokens_used: 0,
        inserted_at: new Date().toISOString(),
        isStreaming: true,
      }
      return { messages: [...s.messages, streamingMsg] }
    })
  },

  // Заменяет стриминговое сообщение финальным с реальным id
  finalizeStreamingMessage: (id, content) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === STREAMING_MSG_ID
          ? { ...m, id, content, isStreaming: false }
          : m
      ),
    }))
  },

  reset: () => {
    set({
      conversations: [],
      conversationsLoading: false,
      conversationsError: null,
      messages: [],
      messagesLoading: false,
      messagesError: null,
      instanceInfo: null,
      instanceLoading: false,
    })
  },
}))
