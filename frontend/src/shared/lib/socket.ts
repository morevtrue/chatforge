// Singleton Phoenix Socket для AI-чата
// Подключается с Bearer-токеном End User-а из endUserAuthStore

import { Socket } from 'phoenix'

let socket: Socket | null = null
// Колбэки ожидающие открытия сокета
let onOpenCallbacks: (() => void)[] = []

/**
 * Возвращает текущий экземпляр Socket (или null если не подключён).
 */
export function getSocket(): Socket | null {
  return socket
}

/**
 * Вызывает callback когда сокет открыт.
 * Если уже открыт — вызывает немедленно.
 */
export function whenSocketReady(callback: () => void): void {
  if (!socket) {
    onOpenCallbacks.push(callback)
    return
  }
  // connectionState() возвращает "open" | "connecting" | "closed"
  if ((socket as unknown as { connectionState: () => string }).connectionState() === 'open') {
    callback()
  } else {
    onOpenCallbacks.push(callback)
  }
}

/**
 * Создаёт и подключает Phoenix Socket.
 * Если уже подключён с тем же токеном — возвращает существующий.
 * Если токен изменился — пересоздаёт соединение.
 * token — Bearer-токен End User-а.
 */
export function connectSocket(token: string): Socket {
  // Если сокет уже существует — отключаем, чтобы переподключиться с актуальным токеном
  if (socket) {
    socket.disconnect()
    socket = null
  }

  const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000/socket'

  socket = new Socket(wsUrl, {
    params: { token },
  })

  socket.onOpen(() => {
    // Вызываем все ожидающие колбэки
    const callbacks = onOpenCallbacks
    onOpenCallbacks = []
    callbacks.forEach((cb) => cb())
  })

  socket.connect()
  return socket
}

/**
 * Отключает Socket и сбрасывает singleton.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  onOpenCallbacks = []
}
