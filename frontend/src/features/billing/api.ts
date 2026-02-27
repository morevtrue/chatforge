// API-функции для системы подписок и монетизации
// Creator API использует Creator-токен (обычные маршруты /api/v1/dashboard/)
// End User API использует End User токен (маршруты /api/v1/chat/)
// Webhook — без токена

import { api } from '@/shared/lib/api'
import type { SubscriptionPlan, Subscription, CheckoutResponse } from './types'

// -------------------------------------------------------------------------
// Creator API — управление тарифными планами
// -------------------------------------------------------------------------

/** Получить список всех планов первого инстанса (legacy) */
export const getPlans = (): Promise<{ plans: SubscriptionPlan[] }> =>
  api.get('/api/v1/dashboard/plans').then((r) => r.data)

/** Получить список планов конкретного инстанса */
export const getPlansByInstance = (instanceId: string): Promise<{ plans: SubscriptionPlan[] }> =>
  api.get(`/api/v1/dashboard/instances/${instanceId}/plans`).then((r) => r.data)

/** Создать новый тарифный план для конкретного инстанса */
export const createPlan = (
  data: Partial<SubscriptionPlan>,
  instanceId?: string
): Promise<{ plan: SubscriptionPlan }> => {
  const url = instanceId
    ? `/api/v1/dashboard/instances/${instanceId}/plans`
    : '/api/v1/dashboard/plans'
  return api.post(url, { plan: data }).then((r) => r.data)
}

/** Обновить тарифный план */
export const updatePlan = (
  id: string,
  data: Partial<SubscriptionPlan>
): Promise<{ plan: SubscriptionPlan }> =>
  api.put(`/api/v1/dashboard/plans/${id}`, { plan: data }).then((r) => r.data)

/** Деактивировать тарифный план */
export const deactivatePlan = (id: string): Promise<{ ok: boolean }> =>
  api.delete(`/api/v1/dashboard/plans/${id}`).then((r) => r.data)

// -------------------------------------------------------------------------
// End User API — просмотр планов и управление подпиской
// -------------------------------------------------------------------------

/** Получить список активных публичных планов (без аутентификации) */
export const getPublicPlans = (): Promise<{ plans: SubscriptionPlan[] }> =>
  api.get('/api/v1/chat/plans').then((r) => r.data)

/** Начать оформление подписки — возвращает URL для оплаты */
export const startSubscription = (planId: string): Promise<CheckoutResponse> =>
  api.post('/api/v1/chat/subscriptions', { plan_id: planId }).then((r) => r.data)

/** Получить текущую активную подписку пользователя */
export const getCurrentSubscription = (): Promise<{ subscription: Subscription | null }> =>
  api.get('/api/v1/chat/subscriptions/current').then((r) => r.data)

// -------------------------------------------------------------------------
// Webhook — подтверждение оплаты (без токена)
// -------------------------------------------------------------------------

/** Подтвердить оплату и создать подписку (вызывается со страницы success) */
export const confirmPayment = (
  planId: string,
  userId: string
): Promise<{ ok: boolean }> =>
  api.post('/api/v1/webhooks/payment', { plan_id: planId, user_id: userId }).then((r) => r.data)
