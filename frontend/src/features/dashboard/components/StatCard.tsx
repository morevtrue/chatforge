// Карточка метрики с числом, лейблом и skeleton-состоянием

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  loading?: boolean
  accent?: string // tailwind color class для иконки
}

export function StatCard({ label, value, icon, loading, accent = 'text-indigo-500' }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-5 space-y-3">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-5 flex items-start gap-4">
      <div className={`mt-0.5 ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{value}</p>
      </div>
    </div>
  )
}
