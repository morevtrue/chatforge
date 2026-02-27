// Страница мониторинга использования AI API
import { useEffect, useState } from 'react'
import { adminApi, type AiUsage } from '@/features/admin/api'

type Period = '7d' | '30d'

export function AdminAiUsagePage() {
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<AiUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async (p: Period) => {
    setLoading(true)
    setError(false)
    try {
      const res = await adminApi.getAiUsage(p)
      setData(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(period) }, [period])

  const totalTokens = data
    ? (data.total_input_tokens ?? 0) + (data.total_output_tokens ?? 0)
    : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Использование AI API</h1>
        {/* Переключатель периода */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {(['7d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p === '7d' ? '7 дней' : '30 дней'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
                <div className="h-8 bg-slate-100 rounded w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-red-600 mb-3">Не удалось загрузить данные</p>
          <button onClick={() => load(period)} className="px-4 py-2 bg-rose-600 text-white text-sm rounded-xl hover:bg-rose-700 transition-colors">
            Повторить
          </button>
        </div>
      ) : (
        <>
          {/* Карточки */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Всего токенов</p>
              <p className="text-3xl font-bold text-slate-900">{totalTokens.toLocaleString('ru-RU')}</p>
              <p className="text-xs text-slate-400 mt-1">
                вход: {(data?.total_input_tokens ?? 0).toLocaleString('ru-RU')} / выход: {(data?.total_output_tokens ?? 0).toLocaleString('ru-RU')}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Стоимость</p>
              <p className="text-3xl font-bold text-slate-900">${data?.total_cost ?? '0'}</p>
              <p className="text-xs text-slate-400 mt-1">за выбранный период</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Инстансов с активностью</p>
              <p className="text-3xl font-bold text-slate-900">{data?.by_instance.length ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">использовали AI API</p>
            </div>
          </div>

          {/* Таблица по инстансам */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Разбивка по инстансам</h2>
            </div>
            {!data?.by_instance.length ? (
              <div className="p-8 text-center text-slate-400 text-sm">Нет данных за период</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Инстанс</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">Входящие токены</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">Исходящие токены</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_instance.map((item) => (
                    <tr key={item.instance_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-700 font-medium">{item.instance_name}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{(item.input_tokens ?? 0).toLocaleString('ru-RU')}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{(item.output_tokens ?? 0).toLocaleString('ru-RU')}</td>
                      <td className="px-5 py-3 text-right text-slate-700 font-medium">${item.cost ?? '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
