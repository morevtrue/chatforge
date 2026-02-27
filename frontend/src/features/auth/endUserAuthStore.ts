// Zustand-стор аутентификации End User-а
// Полностью изолирован от creatorAuthStore
// Токены персистируются в localStorage с ключом per-subdomain для изоляции инстансов

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { chatAuthApi } from './api'
import { registerEndUserTokenGetter } from '@/shared/lib/api'
import type { EndUser, LoginCredentials } from './types'

/**
 * Возвращает subdomain текущего инстанса для изоляции localStorage.
 * На субдомене: test.localhost → "test"
 * Dev-fallback: ?subdomain=test → "test"
 * Основной домен без subdomain → "default"
 */
function getCurrentSubdomain(): string {
  const host = window.location.hostname
  const parts = host.split('.')
  if (parts.length === 2 && parts[1] === 'localhost') return parts[0]
  if (parts.length === 3 && parts[1] === 'chatforge' && parts[2] === 'app') return parts[0]
  const params = new URLSearchParams(window.location.search)
  return params.get('subdomain') ?? 'default'
}

interface EndUserAuthState {
  currentEndUser: EndUser | null
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null

  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  setEndUser: (endUser: EndUser, accessToken: string, refreshToken: string) => void
  clear: () => void
}

export const useEndUserAuthStore = create<EndUserAuthState>()(
  persist(
    (set, get) => ({
      currentEndUser: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,

      login: async (credentials) => {
        const response = await chatAuthApi.login(credentials)
        const { end_user, access_token, refresh_token } = response.data
        set({ currentEndUser: end_user, isAuthenticated: true, accessToken: access_token, refreshToken: refresh_token })
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          if (refreshToken) {
            await chatAuthApi.logout(refreshToken)
          }
        } catch {
          // Игнорируем ошибки при logout
        }
        get().clear()
      },

      setEndUser: (endUser, accessToken, refreshToken) => {
        set({ currentEndUser: endUser, isAuthenticated: true, accessToken, refreshToken })
      },

      clear: () => {
        set({ currentEndUser: null, isAuthenticated: false, accessToken: null, refreshToken: null })
      },
    }),
    {
      // Ключ включает subdomain — каждый инстанс хранит сессию отдельно
      name: `end-user-auth:${getCurrentSubdomain()}`,
    }
  )
)

// Регистрируем геттер токена в API-клиенте
registerEndUserTokenGetter(
  () => useEndUserAuthStore.getState().accessToken,
  () => useEndUserAuthStore.getState().refreshToken,
  () => useEndUserAuthStore.getState().clear()
)
