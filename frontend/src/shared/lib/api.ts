// Axios-инстанс с интерцепторами аутентификации
// Access-токен и refresh-токен хранятся только в памяти (Zustand-стор)

import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// -------------------------------------------------------------------------
// Реестр геттеров токенов — регистрируются сторами при инициализации
// Разрывает циклическую зависимость api.ts ↔ store.ts
// -------------------------------------------------------------------------

type TokenGetter = () => string | null
type StoreClearer = () => void

const tokenRegistry: {
  getCreatorToken: TokenGetter
  getCreatorRefreshToken: TokenGetter
  getEndUserToken: TokenGetter
  getEndUserRefreshToken: TokenGetter
  clearCreator: StoreClearer
  clearEndUser: StoreClearer
} = {
  getCreatorToken: () => null,
  getCreatorRefreshToken: () => null,
  getEndUserToken: () => null,
  getEndUserRefreshToken: () => null,
  clearCreator: () => {},
  clearEndUser: () => {},
}

export function registerCreatorTokenGetter(
  accessGetter: TokenGetter,
  refreshGetter: TokenGetter,
  clearer: StoreClearer
) {
  tokenRegistry.getCreatorToken = accessGetter
  tokenRegistry.getCreatorRefreshToken = refreshGetter
  tokenRegistry.clearCreator = clearer
}

export function registerEndUserTokenGetter(
  accessGetter: TokenGetter,
  refreshGetter: TokenGetter,
  clearer: StoreClearer
) {
  tokenRegistry.getEndUserToken = accessGetter
  tokenRegistry.getEndUserRefreshToken = refreshGetter
  tokenRegistry.clearEndUser = clearer
}

// -------------------------------------------------------------------------
// Request interceptor — добавляет Authorization: Bearer <accessToken>
// Изоляция: chat-маршруты используют End User токен, остальные — Creator токен
// На субдомене чат-инстанса добавляет X-Subdomain заголовок для TenantResolver
// -------------------------------------------------------------------------

function getSubdomain(): string | null {
  const host = window.location.hostname
  const parts = host.split('.')
  if (parts.length === 2 && parts[1] === 'localhost') return parts[0]
  if (parts.length === 3 && parts[1] === 'chatforge' && parts[2] === 'app') return parts[0]
  // Dev-fallback: ?subdomain=xxx в URL
  const params = new URLSearchParams(window.location.search)
  const sub = params.get('subdomain')
  if (sub) return sub
  return null
}

api.interceptors.request.use((config) => {
  const url = config.url ?? ''
  const isChatRoute = url.startsWith('/api/v1/chat/')
  const token = isChatRoute
    ? tokenRegistry.getEndUserToken()
    : tokenRegistry.getCreatorToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Передаём субдомен через заголовок — Vite proxy теряет Host при changeOrigin
  const subdomain = getSubdomain()
  if (subdomain && isChatRoute) {
    config.headers['X-Subdomain'] = subdomain
  }
  return config
})

// -------------------------------------------------------------------------
// Response interceptor — при 401 обновляет токен и повторяет запрос
// -------------------------------------------------------------------------

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Не пытаемся рефрешить сам refresh-запрос
    if (originalRequest.url?.includes('/auth/refresh')) {
      tokenRegistry.clearCreator()
      tokenRegistry.clearEndUser()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    originalRequest._retry = true

    // Определяем контекст по URL запроса, а не по наличию токена
    const isChatRequest = originalRequest.url?.startsWith('/api/v1/chat/')
    const isCreator = !isChatRequest

    const hasToken = isCreator
      ? !!tokenRegistry.getCreatorToken()
      : !!tokenRegistry.getEndUserToken()

    if (!hasToken) {
      return Promise.reject(error)
    }

    // Получаем refresh-токен из памяти
    const refreshToken = isCreator
      ? tokenRegistry.getCreatorRefreshToken()
      : tokenRegistry.getEndUserRefreshToken()

    if (!refreshToken) {
      tokenRegistry.clearCreator()
      tokenRegistry.clearEndUser()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(api(originalRequest))
        })
      })
    }

    isRefreshing = true

    try {
      const refreshUrl = isCreator ? '/api/v1/auth/refresh' : '/api/v1/chat/auth/refresh'
      // Передаём refresh-токен в теле запроса
      const { data } = await api.post<{ access_token: string; refresh_token: string }>(
        refreshUrl,
        { refresh_token: refreshToken }
      )
      const newAccessToken = data.access_token
      const newRefreshToken = data.refresh_token

      // Обновляем сторы через динамический импорт
      if (isCreator) {
        const { useCreatorAuthStore } = await import('@/features/auth/creatorAuthStore')
        const store = useCreatorAuthStore.getState()
        store.setUser(store.currentUser!, newAccessToken, newRefreshToken)
      } else {
        const { useEndUserAuthStore } = await import('@/features/auth/endUserAuthStore')
        const store = useEndUserAuthStore.getState()
        store.setEndUser(store.currentEndUser!, newAccessToken, newRefreshToken)
      }

      refreshQueue.forEach((cb) => cb(newAccessToken))
      refreshQueue = []

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } catch {
      refreshQueue = []
      tokenRegistry.clearCreator()
      tokenRegistry.clearEndUser()
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)
