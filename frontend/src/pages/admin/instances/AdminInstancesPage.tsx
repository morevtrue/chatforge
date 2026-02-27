// Страница управления инстансами
import { useEffect, useState } from 'react'
import { adminApi, type InstanceRow, type InstancesPage } from '@/features/admin/api'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Активен',      cls: 'bg-green-50 text-green-700' },
    suspended: { label: 'Приостановлен', cls: 'bg-red-50 text-red-600' },
    draft:     { label: 'Черновик',     cls: 'bg-slate-100 text-slate-500' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export function AdminInstancesPage() {
  const [data, setData] = useState<InstancesPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const load = async (st: string, p: number) => {
    setLoading(true)
    setError(false)
    try {
      const res = await adminApi.listInstances({
        page: p,
        status: st !== 'all' ? st : undefined,
      })
      setData(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(status, page) }, [status, page])

  const handleSuspend = async (instance: InstanceRow) => {
    if (!window.confirm(`Приостановить инстанс "${instance.name}"?`)) return
    try {
      await adminApi.suspendInstance(instance.id)
      load(status, page)
    } catch {
      alert('Ошибка при приостановке')
    }
  }

  const handleActivate = async (instance: InstanceRow) => {
    if (!window.confirm(`Восстановить инстанс "${instance.name}"?`)) return
    try {
      await adminApi.activateInstance(instance.id)
      load(status, page)
    } catch {
      alert('Ошибка при восстановлении')
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Инстансы</h1>

      {/* Фильтр */}
      <div className="flex gap-3 mb-5">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="suspended">Приостановленные</option>
          <option value="draft">Черновики</option>
        </select>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Загрузка...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500 text-sm mb-3">Ошибка загрузки</p>
            <button onClick={() => load(status, page)} className="px-4 py-2 bg-rose-600 text-white text-sm rounded-xl hover:bg-rose-700 transition-colors">
              Повторить
            </button>
          </div>
        ) : !data?.instances.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">Нет инстансов</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Название</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Поддомен</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Creator</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Статус</th>
                <th className="text-right px-5 py-3 text-slate-500 font-medium">Пользователи</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Создан</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.instances.map((inst) => (
                <tr key={inst.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-slate-700 font-medium">{inst.name}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{inst.subdomain}</td>
                  <td className="px-5 py-3 text-slate-500">{inst.creator_email ?? '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={inst.status} /></td>
                  <td className="px-5 py-3 text-right text-slate-600">{inst.end_users_count ?? 0}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(inst.inserted_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {inst.status === 'active' ? (
                      <button
                        onClick={() => handleSuspend(inst)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        Приостановить
                      </button>
                    ) : inst.status === 'suspended' ? (
                      <button
                        onClick={() => handleActivate(inst)}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        Восстановить
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Пагинация */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Всего: {data.total}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ←
            </button>
            <span>{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
