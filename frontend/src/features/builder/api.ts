// Типизированные функции для builder-эндпоинтов
// Используют API-клиент из shared/lib/api.ts

import { api } from '@/shared/lib/api'
import type { WizardState, ChatInstance, SubdomainValidation } from './types'

export const builderApi = {
  /** Начать визард (идемпотентный) */
  startWizard: () =>
    api.post<{ wizard_state: WizardState }>('/api/v1/builder/start', {}),

  /** Получить текущий прогресс визарда */
  getWizardState: () =>
    api.get<{ wizard_state: WizardState }>('/api/v1/builder/state'),

  /** Сохранить данные шага */
  updateStep: (step: number, data: Record<string, unknown>) =>
    api.put<{ wizard_state: WizardState }>(`/api/v1/builder/step/${step}`, data),

  /** Загрузить аватар */
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post<{ avatar_url: string }>('/api/v1/builder/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** Финализировать визард */
  finalize: () =>
    api.post<{ chat_instance: ChatInstance }>('/api/v1/builder/finalize', {}),

  /** Проверить доступность поддомена */
  validateSubdomain: (subdomain: string) =>
    api.get<SubdomainValidation>(`/api/v1/builder/validate-subdomain`, {
      params: { subdomain },
    }),
}
