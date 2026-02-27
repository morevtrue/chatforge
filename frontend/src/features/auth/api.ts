// Типизированные функции для auth-эндпоинтов
// Используют API-клиент из shared/lib/api.ts

import { api } from '@/shared/lib/api'
import type {
  AuthResponse,
  EndUserAuthResponse,
  LoginCredentials,
  RegisterCredentials,
  RefreshResponse,
  User,
  EndUser,
} from './types'

// -------------------------------------------------------------------------
// Creator API
// -------------------------------------------------------------------------

export const authApi = {
  /** Регистрация Creator-а */
  register: (credentials: RegisterCredentials) =>
    api.post<AuthResponse>('/api/v1/auth/register', credentials),

  /** Вход Creator-а */
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/api/v1/auth/login', credentials),

  /** Выход Creator-а */
  logout: (refreshToken: string) =>
    api.post<void>('/api/v1/auth/logout', { refresh_token: refreshToken }),

  /** Обновление токенов Creator-а */
  refresh: (refreshToken: string) =>
    api.post<RefreshResponse>('/api/v1/auth/refresh', { refresh_token: refreshToken }),

  /** Профиль текущего Creator-а */
  me: () => api.get<{ user: User }>('/api/v1/auth/me'),
}

// -------------------------------------------------------------------------
// End User API
// -------------------------------------------------------------------------

export const chatAuthApi = {
  /** Регистрация End User-а */
  register: (credentials: Omit<RegisterCredentials, 'phone' | 'telegram'>) =>
    api.post<EndUserAuthResponse>('/api/v1/chat/auth/register', credentials),

  /** Вход End User-а */
  login: (credentials: LoginCredentials) =>
    api.post<EndUserAuthResponse>('/api/v1/chat/auth/login', credentials),

  /** Выход End User-а */
  logout: (refreshToken: string) =>
    api.post<void>('/api/v1/chat/auth/logout', { refresh_token: refreshToken }),

  /** Обновление токенов End User-а */
  refresh: (refreshToken: string) =>
    api.post<RefreshResponse>('/api/v1/chat/auth/refresh', { refresh_token: refreshToken }),

  /** Профиль текущего End User-а */
  me: () => api.get<{ end_user: EndUser }>('/api/v1/chat/auth/me'),
}
