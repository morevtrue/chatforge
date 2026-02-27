// Типы аутентификации для Creator-ов и End User-ов

export interface User {
  id: string
  email: string
  name: string
  role: string
  status: string
}

export interface EndUser {
  id: string
  email: string
  name: string
  messages_used: number
  chat_instance_id: string
}

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
}

export interface EndUserAuthResponse {
  end_user: EndUser
  access_token: string
  refresh_token: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  name: string
  phone?: string
  telegram?: string
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
}
