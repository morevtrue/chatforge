// API-клиент для аналитики Creator-а
import { api } from '@/shared/lib/api'

export type Period = '7d' | '30d' | '90d'

export interface OverviewData {
  total_users: number
  total_messages: number
  active_subscriptions: number
  revenue: number
  conversion_rate: number
}

export interface DailyPoint {
  date: string
  count: number
}

export interface DailyRevenue {
  date: string
  amount: number
}

export const analyticsApi = {
  overview: (instanceId?: string | number) => {
    const q = instanceId ? `?instance_id=${instanceId}` : ''
    return api.get<{ data: OverviewData }>(`/api/v1/dashboard/analytics/overview${q}`)
  },

  messages: (period: Period, instanceId?: string | number) => {
    const q = instanceId ? `&instance_id=${instanceId}` : ''
    return api.get<{ data: DailyPoint[] }>(`/api/v1/dashboard/analytics/messages?period=${period}${q}`)
  },

  users: (period: Period, instanceId?: string | number) => {
    const q = instanceId ? `&instance_id=${instanceId}` : ''
    return api.get<{ data: DailyPoint[] }>(`/api/v1/dashboard/analytics/users?period=${period}${q}`)
  },

  revenue: (period: Period, instanceId?: string | number) => {
    const q = instanceId ? `&instance_id=${instanceId}` : ''
    return api.get<{ data: DailyRevenue[] }>(`/api/v1/dashboard/analytics/revenue?period=${period}${q}`)
  },
}
