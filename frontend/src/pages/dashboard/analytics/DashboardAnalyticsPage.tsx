// Страница аналитики Creator-а
// Три графика: сообщения, регистрации, доход — с переключателем периода

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { analyticsApi } from '@/features/dashboard/analyticsApi'
import { PeriodSelector } from '@/features/dashboard/components/PeriodSelector'
import { useInstance } from '@/pages/dashboard/DashboardLayout'
import type { Period, DailyPoint, DailyRevenue } from '@/features/dashboard/analyticsApi'

// Skeleton для графика
function ChartSkeleton() {
  return (
    <div className="h-48 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse" />
  )
}

// Обёртка карточки графика
function ChartCard({ title, children, loading }: {
  title: string
  children: React.ReactNode
  loading: boolean
}) {
  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 space-y-4">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {loading ? <ChartSkeleton /> : children}
    </div>
  )
}

// Форматирование даты "2026-02-15" → "15 фев"
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function DashboardAnalyticsPage() {
  const { instance } = useInstance()
  const [period, setPeriod] = useState<Period>('30d')
  const [messages, setMessages] = useState<DailyPoint[]>([])
  const [users, setUsers] = useState<DailyPoint[]>([])
  const [revenue, setRevenue] = useState<DailyRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(false)
    Promise.all([
      analyticsApi.messages(period, instance?.id),
      analyticsApi.users(period, instance?.id),
      analyticsApi.revenue(period, instance?.id),
    ])
      .then(([msgRes, usrRes, revRes]) => {
        setMessages(msgRes.data.data)
        setUsers(usrRes.data.data)
        setRevenue(revRes.data.data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [period, instance?.id, retryCount])

  // Форматируем данные для recharts
  const messagesData = messages.map((d) => ({ date: formatDate(d.date), value: d.count }))
  const usersData = users.map((d) => ({ date: formatDate(d.date), value: d.count }))
  const revenueData = revenue.map((d) => ({ date: formatDate(d.date), value: Number(d.amount) }))

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="text-3xl">😕</div>
        <p className="text-slate-600 dark:text-slate-300 font-medium">Не удалось загрузить аналитику</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="text-sm text-indigo-600 hover:underline"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Аналитика</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Динамика активности вашего чата</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* График сообщений */}
      <ChartCard title="Сообщения по дням" loading={loading}>
        {messagesData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={messagesData}>
              <defs>
                <linearGradient id="gradMessages" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="value" name="Сообщений" stroke="#6366f1" strokeWidth={2} fill="url(#gradMessages)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* График регистраций */}
      <ChartCard title="Новые пользователи по дням" loading={loading}>
        {usersData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={usersData}>
              <defs>
                <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="value" name="Регистраций" stroke="#10b981" strokeWidth={2} fill="url(#gradUsers)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* График дохода */}
      <ChartCard title="Доход по дням (₽)" loading={loading}>
        {revenueData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number | undefined) => [`${v ?? 0} ₽`, 'Доход']}
              />
              <Area type="monotone" dataKey="value" name="Доход" stroke="#f59e0b" strokeWidth={2} fill="url(#gradRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
      Нет данных за выбранный период
    </div>
  )
}
