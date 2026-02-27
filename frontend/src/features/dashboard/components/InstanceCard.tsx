// Карточка инстанса — название, поддомен, статус

import type { ChatInstance } from '@/features/builder/types'

interface InstanceCardProps {
  instance: ChatInstance
}

const STATUS_CONFIG: Record<ChatInstance['status'], { label: string; dot: string; bg: string; text: string }> = {
  draft:     { label: 'Черновик',      dot: 'bg-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-900/30',   text: 'text-yellow-700 dark:text-yellow-300' },
  active:    { label: 'Активен',       dot: 'bg-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  suspended: { label: 'Приостановлен', dot: 'bg-red-400',     bg: 'bg-red-50 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-300' },
}

export function InstanceCard({ instance }: InstanceCardProps) {
  const status = STATUS_CONFIG[instance.status]

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          {instance.settings?.avatar_url ? (
            <img
              src={instance.settings.avatar_url}
              alt="Аватар"
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-100 dark:ring-indigo-900 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 shrink-0">
              {instance.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 truncate">{instance.name}</h2>
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.bg} ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate">{instance.subdomain}.chatforge.app</p>
          </div>
        </div>
      </div>
    </div>
  )
}
