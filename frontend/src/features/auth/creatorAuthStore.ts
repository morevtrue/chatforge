// Zustand-стор аутентификации Creator-а
// Access-токен хранится в localStorage для персистентности между перезагрузками
// Refresh-токен тоже хранится в localStorage

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from './api'
import { registerCreatorTokenGetter } from '@/shared/lib/api'
import type { User, LoginCredentials, RegisterCredentials } from './types'

interface CreatorAuthState {
  currentUser: User | null
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null

  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User, accessToken: string, refreshToken: string) => void
  clear: () => void
}

export const useCreatorAuthStore = create<CreatorAuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,

      login: async (credentials) => {
        const response = await authApi.login(credentials)
        const { user, access_token, refresh_token } = response.data
        set({ currentUser: user, isAuthenticated: true, accessToken: access_token, refreshToken: refresh_token })
      },

      register: async (credentials) => {
        const response = await authApi.register(credentials)
        const { user, access_token, refresh_token } = response.data
        set({ currentUser: user, isAuthenticated: true, accessToken: access_token, refreshToken: refresh_token })
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          if (refreshToken) {
            await authApi.logout(refreshToken)
          }
        } catch {
          // Игнорируем ошибки при logout
        }
        get().clear()
      },

      setUser: (user, accessToken, refreshToken) => {
        set({ currentUser: user, isAuthenticated: true, accessToken, refreshToken })
      },

      clear: () => {
        set({ currentUser: null, isAuthenticated: false, accessToken: null, refreshToken: null })
      },
    }),
    {
      name: 'creator-auth',
    }
  )
)

// Регистрируем геттер токена в API-клиенте (разрывает циклическую зависимость)
registerCreatorTokenGetter(
  () => useCreatorAuthStore.getState().accessToken,
  () => useCreatorAuthStore.getState().refreshToken,
  () => useCreatorAuthStore.getState().clear()
)
