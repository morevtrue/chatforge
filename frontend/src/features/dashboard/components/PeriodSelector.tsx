// Переключатель периода аналитики: 7д / 30д / 90д
import type { Period } from '../analyticsApi'

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d',  label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
]

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
            value === p.value
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
