// Страница обзора дашборда Creator-а
// Сводные карточки: пользователи, сообщения, подписки, доход, конверсия

import { useEffect, useState } from 'react'
import { analyticsApi } from '@/features/dashboard/analyticsApi'
import { StatCard } from '@/features/dashboard/components/StatCard'
import { useInstance } from '@/pages/dashboard/DashboardLayout'
import type { OverviewData } from '@/features/dashboard/analyticsApi'

// Иконки
function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconMessages() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function IconSubscriptions() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )
}

function IconRevenue() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}

export function DashboardOverviewPage() {
  const { instance } = useInstance()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    analyticsApi.overview(instance?.id)
      .then((res) => setData(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [instance?.id])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="text-3xl">😕</div>
        <p className="text-slate-600 dark:text-slate-300 font-medium">Не удалось загрузить аналитику</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-indigo-600 hover:underline"
        >
          Обновить страницу
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Обзор</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Сводные метрики за последние 30 дней</p>
      </div>

      {/* Карточки метрик */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Пользователи"
          value={loading ? '' : (data?.total_users ?? 0)}
          icon={<IconUsers />}
          loading={loading}
          accent="text-indigo-500"
        />
        <StatCard
          label="Сообщений (30д)"
          value={loading ? '' : (data?.total_messages ?? 0)}
          icon={<IconMessages />}
          loading={loading}
          accent="text-purple-500"
        />
        <StatCard
          label="Активных подписок"
          value={loading ? '' : (data?.active_subscriptions ?? 0)}
          icon={<IconSubscriptions />}
          loading={loading}
          accent="text-emerald-500"
        />
        <StatCard
          label="Доход (30д)"
          value={loading ? '' : `${Number(data?.revenue ?? 0).toFixed(0)} ₽`}
          icon={<IconRevenue />}
          loading={loading}
          accent="text-amber-500"
        />
      </div>

      {/* Карточка конверсии */}
      {!loading && data && (
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Конверсия в платных</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Доля пользователей с активной подпиской</p>
            </div>
            <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {data.conversion_rate}%
            </span>
          </div>
          {/* Прогресс-бар */}
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(data.conversion_rate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400 dark:text-slate-500">
            <span>{data.active_subscriptions} платных</span>
            <span>{data.total_users} всего</span>
          </div>
        </div>
      )}

      {/* Skeleton конверсии */}
      {loading && (
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 space-y-3">
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  )
}
