// Хук для работы с Phoenix Channel конкретного диалога
// Управляет подключением, стримингом и отправкой сообщений

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Channel } from 'phoenix'
import { getSocket, connectSocket, whenSocketReady } from '@/shared/lib/socket'
import { useEndUserAuthStore } from '@/features/auth/endUserAuthStore'
import { useChatStore } from '../chatStore'
import type { Message } from '../types'
import { chatAuthApi } from '@/features/auth/api'

interface UseChatReturn {
  messages: Message[]
  sendMessage: (content: string) => void
  isStreaming: boolean
  error: string | null
  isLimitReached: boolean
}

// UUID v4 regex — защита от субдоменов и произвольных строк в :id
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function useChat(conversationId: string): UseChatReturn {
  const channelRef = useRef<Channel | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLimitReached, setIsLimitReached] = useState(false)

  const accessToken = useEndUserAuthStore((s) => s.accessToken)
  const messages = useChatStore((s) => s.messages)
  const { addMessage, updateStreamingMessage, finalizeStreamingMessage } = useChatStore.getState()

  useEffect(() => {
    // Не подключаемся если id не UUID — защита от субдоменов в :id параметре
    if (!conversationId || !accessToken || !UUID_REGEX.test(conversationId)) return

    // Гарантируем что сокет подключён
    if (!getSocket()) {
      connectSocket(accessToken)
    }

    let channel: Channel | null = null
    let cancelled = false

    // Ждём открытия сокета перед созданием канала
    whenSocketReady(() => {
      if (cancelled) return

      const sock = getSocket()
      if (!sock) return

      channel = sock.channel(`chat:${conversationId}`, {})
      channelRef.current = channel

      channel.on('message_chunk', ({ content }: { content: string }) => {
        setIsStreaming(true)
        updateStreamingMessage(content)
      })

      channel.on('message_done', ({ message_id, content }: { message_id: string; content: string }) => {
        finalizeStreamingMessage(message_id, content)
        setIsStreaming(false)
        // Обновляем messages_used в сторе после успешной отправки
        chatAuthApi.me().then((res) => {
          const { setEndUser } = useEndUserAuthStore.getState()
          const { accessToken: at, refreshToken: rt } = useEndUserAuthStore.getState()
          if (at && rt) setEndUser(res.data.end_user, at, rt)
        }).catch(() => {/* игнорируем ошибки обновления счётчика */})
      })

      channel.on('message_error', ({ reason }: { reason: string }) => {
        setIsStreaming(false)
        setError(reason)
        toast.error('Ошибка AI: ' + reason)
      })

      channel.on('limit_reached', () => {
        setIsLimitReached(true)
      })

      channel.join()
        .receive('error', (resp: unknown) => {
          console.error('Ошибка подключения к каналу:', resp)
          toast.error('Не удалось подключиться к чату')
        })
    })

    return () => {
      cancelled = true
      if (channel) {
        channel.leave()
      }
      channelRef.current = null
    }
  }, [conversationId, accessToken])

  const sendMessage = useCallback((content: string) => {
    if (!channelRef.current || isStreaming || isLimitReached) return

    // Оптимистично добавляем сообщение пользователя
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      tokens_used: 0,
      inserted_at: new Date().toISOString(),
    }
    addMessage(optimisticMsg)

    setError(null)
    channelRef.current.push('send_message', { content })
  }, [isStreaming, isLimitReached, addMessage])

  return { messages, sendMessage, isStreaming, error, isLimitReached }
}
