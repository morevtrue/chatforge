// Страница отмены оплаты подписки

import { useNavigate } from 'react-router-dom'

export function SubscriptionCancelPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
        <div className="w-14 h-14 rounded-full bg-yellow-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="font-bold text-gray-800 text-lg mb-1">Оплата отменена</p>
        <p className="text-sm text-gray-500 mb-6">Подписка не была оформлена</p>
        <button
          onClick={() => navigate('/chat')}
          className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors"
        >
          Вернуться в чат
        </button>
      </div>
    </div>
  )
}
