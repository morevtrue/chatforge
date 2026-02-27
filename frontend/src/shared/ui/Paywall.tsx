// Компонент Paywall — модальное окно при исчерпании лимита сообщений
// Показывает доступные тарифные планы и позволяет оформить подписку

import { useEffect, useState } from 'react'
import { useBillingStore } from '@/features/billing/billingStore'
import { startSubscription } from '@/features/billing/api'
import type { SubscriptionPlan } from '@/features/billing/types'

interface PaywallProps {
  // Объект темы из ConversationPage
  theme: {
    bg: string
    surface: string
    border: string
    text: string
    subtext: string
    headerBg: string
    headerText: string
  }
  primary: string
  isDark: boolean
  onClose: () => void
}

function PlanCard({
  plan,
  primary,
  theme,
  isDark,
  onSubscribe,
}: {
  plan: SubscriptionPlan
  primary: string
  theme: PaywallProps['theme']
  isDark: boolean
  onSubscribe: (planId: string) => void
}) {
  const price = parseFloat(plan.price)
  const periodLabel = plan.period === 'monthly' ? 'мес' : 'год'
  const limitLabel = plan.message_limit === null ? 'Безлимит' : `${plan.message_limit} сообщений`

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : `${primary}08`,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : `${primary}25`}`,
      }}
    >
      <div>
        <p className="font-semibold text-sm" style={{ color: theme.text }}>{plan.name}</p>
        <p className="text-xs mt-0.5" style={{ color: theme.subtext }}>{limitLabel}</p>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold" style={{ color: primary }}>{price.toFixed(0)}</span>
        <span className="text-sm mb-0.5" style={{ color: theme.subtext }}>₽/{periodLabel}</span>
      </div>
      <button
        onClick={() => onSubscribe(plan.id)}
        className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
        style={{ background: primary }}
      >
        Оформить
      </button>
    </div>
  )
}

export function Paywall({ theme, primary, isDark, onClose }: PaywallProps) {
  const publicPlans = useBillingStore((s) => s.publicPlans)
  const publicPlansLoading = useBillingStore((s) => s.publicPlansLoading)
  const fetchPublicPlans = useBillingStore((s) => s.fetchPublicPlans)
  const closePaywall = useBillingStore((s) => s.closePaywall)

  const [subscribeError, setSubscribeError] = useState<string | null>(null)
  const [plansError, setPlansError] = useState<string | null>(null)

  useEffect(() => {
    fetchPublicPlans().catch(() => setPlansError('Не удалось загрузить планы. Попробуйте позже.'))
  }, [fetchPublicPlans])

  const handleSubscribe = async (planId: string) => {
    setSubscribeError(null)
    try {
      const { checkout_url } = await startSubscription(planId)
      window.location.href = checkout_url
    } catch {
      setSubscribeError('Не удалось оформить подписку. Попробуйте ещё раз.')
    }
  }

  const handleClose = () => {
    closePaywall()
    onClose()
  }

  return (
    // Оверлей
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      {/* Модальное окно */}
      <div
        className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-base" style={{ color: theme.text }}>
              Лимит исчерпан
            </p>
            <p className="text-xs mt-0.5" style={{ color: theme.subtext }}>
              Оформите подписку для продолжения
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: theme.subtext }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Список планов */}
        {publicPlansLoading ? (
          // Skeleton-загрузчик
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
              />
            ))}
          </div>
        ) : plansError ? (
          <p className="text-sm text-center py-4 text-red-500">{plansError}</p>
        ) : publicPlans.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: theme.subtext }}>
            Нет доступных планов
          </p>
        ) : (
          <div className="space-y-3">
            {publicPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                primary={primary}
                theme={theme}
                isDark={isDark}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>
        )}

        {/* Ошибка оформления подписки */}
        {subscribeError && (
          <p className="text-xs text-center text-red-500 -mt-1">{subscribeError}</p>
        )}
      </div>
    </div>
  )
}
