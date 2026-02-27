// Страница обзора Admin-панели — сводная статистика платформы + графики
import { useEffect, useState } from 'react'
import { adminApi, type PlatformStats, type AiUsage } from '@/features/admin/api'

// ── Карточка статистики ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Горизонтальный бар-чарт ──────────────────────────────────────────────────

interface BarItem {
  label: string
  value: number
  color: string
}

function HorizontalBarChart({ items, title, unit }: { items: BarItem[]; title: string; unit?: string }) {
  const max = Math.max(...items.map(i => i.value), 1)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{item.label}</span>
              <span className="text-xs font-medium text-slate-700">
                {item.value.toLocaleString('ru-RU')}{unit ? ` ${unit}` : ''}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">Нет данных</p>
        )}
      </div>
    </div>
  )
}

// ── Основной компонент ───────────────────────────────────────────────────────

export function AdminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      const [statsRes, aiRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getAiUsage('30d'),
      ])
      setStats(statsRes.data.stats)
      setAiUsage(aiRes.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Обзор платформы</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-32 mb-4" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j}>
                    <div className="h-3 bg-slate-100 rounded w-20 mb-1" />
                    <div className="h-2 bg-slate-100 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Обзор платформы</h1>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-red-600 mb-3">Не удалось загрузить статистику</p>
          <button onClick={load} className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition-colors">
            Повторить
          </button>
        </div>
      </div>
    )
  }

  // Данные для графика AI Usage по инстансам (топ-5 по стоимости)
  const aiBarColors = ['bg-violet-500', 'bg-blue-500', 'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500']
  const aiCostItems: BarItem[] = (aiUsage?.by_instance ?? [])
    .slice(0, 5)
    .map((item, i) => ({
      label: item.instance_name,
      value: parseFloat(item.cost) || 0,
      color: aiBarColors[i % aiBarColors.length],
    }))

  const aiTokenItems: BarItem[] = (aiUsage?.by_instance ?? [])
    .slice(0, 5)
    .map((item, i) => ({
      label: item.instance_name,
      value: (item.input_tokens ?? 0) + (item.output_tokens ?? 0),
      color: aiBarColors[i % aiBarColors.length],
    }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Обзор платформы</h1>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Creator-ы" value={stats?.total_creators ?? 0} sub="всего зарегистрировано" color="bg-blue-500" />
        <StatCard label="Активные инстансы" value={stats?.active_instances ?? 0} sub="чатов в работе" color="bg-emerald-500" />
        <StatCard label="Сообщений" value={(stats?.total_messages ?? 0).toLocaleString('ru-RU')} sub="за всё время" color="bg-violet-500" />
        <StatCard label="Доход" value={`${stats?.total_revenue ?? '0'} ₽`} sub="суммарно" color="bg-amber-500" />
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HorizontalBarChart
          title="Топ-5 инстансов по стоимости AI (30д)"
          items={aiCostItems}
          unit="$"
        />
        <HorizontalBarChart
          title="Топ-5 инстансов по токенам AI (30д)"
          items={aiTokenItems}
        />
      </div>
    </div>
  )
}
