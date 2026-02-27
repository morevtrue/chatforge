// Страница подтверждения оплаты подписки
// Вызывает webhook confirmPayment при монтировании

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { confirmPayment } from '@/features/billing/api'
import { useBillingStore } from '@/features/billing/billingStore'

export function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const fetchCurrentSubscription = useBillingStore((s) => s.fetchCurrentSubscription)

  const planId = searchParams.get('plan_id') ?? ''
  const userId = searchParams.get('user_id') ?? ''

  const confirm = async () => {
    setStatus('loading')
    try {
      await confirmPayment(planId, userId)
      // Обновляем подписку в сторе сразу после подтверждения
      await fetchCurrentSubscription()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    if (planId && userId) {
      confirm()
    } else {
      setStatus('error')
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
        {status === 'loading' && (
          <>
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-800">Подтверждаем оплату...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-bold text-gray-800 text-lg mb-1">Подписка оформлена</p>
            <p className="text-sm text-gray-500 mb-6">Теперь вам доступны все возможности плана</p>
            <button
              onClick={() => navigate('/chat')}
              className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors"
            >
              Вернуться в чат
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-bold text-gray-800 text-lg mb-1">Ошибка подтверждения</p>
            <p className="text-sm text-gray-500 mb-6">Не удалось активировать подписку</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirm}
                className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors"
              >
                Попробовать снова
              </button>
              <button
                onClick={() => navigate('/chat')}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Вернуться в чат
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
