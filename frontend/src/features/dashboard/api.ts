// Типизированные функции для dashboard-эндпоинтов
// Используют API-клиент из shared/lib/api.ts

import { api } from '@/shared/lib/api'
import type { ChatInstance } from '@/features/builder/types'

export interface UpdateSettingsPayload {
  instance_id: string
  primary_color?: string
  secondary_color?: string
  background_color?: string
  greeting_text?: string
  example_questions?: string[]
  system_prompt?: string
  free_messages_limit?: number
}

export const dashboardApi = {
  /** Получить все инстансы текущего Creator-а */
  getInstances: () =>
    api.get<{ chat_instances: ChatInstance[] }>('/api/v1/dashboard/instances'),

  /** Получить данные первого инстанса текущего Creator-а (legacy) */
  getInstance: () =>
    api.get<{ chat_instance: ChatInstance }>('/api/v1/dashboard/instance'),

  /** Получить данные конкретного инстанса по id */
  getInstanceById: (instanceId: string) =>
    api.get<{ chat_instance: ChatInstance }>(`/api/v1/dashboard/instances/${instanceId}`),

  /** Обновить настройки инстанса */
  updateSettings: (payload: UpdateSettingsPayload) => {
    const { instance_id, ...rest } = payload
    return api.put<{ chat_instance: ChatInstance }>(
      `/api/v1/dashboard/instances/${instance_id}/settings`,
      rest
    )
  },

  /** Загрузить новый аватар */
  uploadAvatar: (instanceId: string, file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post<{ avatar_url: string }>(
      `/api/v1/dashboard/instances/${instanceId}/avatar`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}
