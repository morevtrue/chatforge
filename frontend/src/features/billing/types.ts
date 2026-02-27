// Типы для системы подписок и монетизации (Phase 5)

export interface SubscriptionPlan {
  id: string
  name: string
  price: string  // decimal приходит как строка из Elixir
  period: 'monthly' | 'yearly'
  message_limit: number | null  // null = безлимит
  is_active: boolean
  inserted_at?: string
}

export interface Subscription {
  id: string
  status: 'active' | 'expired' | 'cancelled'
  starts_at: string
  expires_at: string
  plan: SubscriptionPlan
}

export interface CheckoutResponse {
  checkout_url: string
}
