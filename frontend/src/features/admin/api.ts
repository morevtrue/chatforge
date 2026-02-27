// API-клиент для Admin-панели
import { api } from '@/shared/lib/api'

// ── Типы ────────────────────────────────────────────────────────────────────

export interface PlatformStats {
  total_creators: number
  active_instances: number
  total_messages: number
  total_revenue: string
}

export interface CreatorRow {
  id: string
  email: string
  name: string
  role: string
  status: string
  inserted_at: string
  instances_count?: number
}

export interface CreatorsPage {
  creators: CreatorRow[]
  total: number
  page: number
  per_page: number
}

export interface InstanceRow {
  id: string
  name: string
  subdomain: string
  status: string
  currency: string
  creator_id: string
  creator_email: string | null
  inserted_at: string
  end_users_count?: number
}

export interface InstancesPage {
  instances: InstanceRow[]
  total: number
  page: number
  per_page: number
}

export interface CreatorDetail {
  creator: CreatorRow
  instances: InstanceRow[]
}

export interface AiUsageByInstance {
  instance_id: string
  instance_name: string
  input_tokens: number
  output_tokens: number
  cost: string
}

export interface AiUsage {
  period: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost: string
  by_instance: AiUsageByInstance[]
}

// ── API-функции ──────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () =>
    api.get<{ stats: PlatformStats }>('/api/v1/admin/stats'),

  listCreators: (params?: { page?: number; search?: string; status?: string }) =>
    api.get<CreatorsPage>('/api/v1/admin/creators', { params }),

  getCreator: (id: string) =>
    api.get<CreatorDetail>(`/api/v1/admin/creators/${id}`),

  suspendCreator: (id: string) =>
    api.put<{ creator: CreatorRow }>(`/api/v1/admin/creators/${id}/suspend`),

  activateCreator: (id: string) =>
    api.put<{ creator: CreatorRow }>(`/api/v1/admin/creators/${id}/activate`),

  listInstances: (params?: { page?: number; status?: string }) =>
    api.get<InstancesPage>('/api/v1/admin/instances', { params }),

  suspendInstance: (id: string) =>
    api.put<{ instance: InstanceRow }>(`/api/v1/admin/instances/${id}/suspend`),

  activateInstance: (id: string) =>
    api.put<{ instance: InstanceRow }>(`/api/v1/admin/instances/${id}/activate`),

  getAiUsage: (period: '7d' | '30d') =>
    api.get<AiUsage>('/api/v1/admin/ai-usage', { params: { period } }),
}
