// Страница управления Creator-ами
import { useEffect, useRef, useState } from 'react'
import { adminApi, type CreatorRow, type CreatorsPage } from '@/features/admin/api'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      status === 'active'
        ? 'bg-green-50 text-green-700'
        : 'bg-red-50 text-red-600'
    }`}>
      {status === 'active' ? 'Активен' : 'Заблокирован'}
    </span>
  )
}

export function AdminCreatorsPage() {
  const [data, setData] = useState<CreatorsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async (s: string, st: string, p: number) => {
    setLoading(true)
    setError(false)
    try {
      const res = await adminApi.listCreators({
        page: p,
        search: s || undefined,
        status: st !== 'all' ? st : undefined,
      })
      setData(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(search, status, page) }, [status, page])

  // Debounce поиска 300ms
  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(val, status, 1), 300)
  }

  const handleStatusFilter = (val: string) => {
    setStatus(val)
    setPage(1)
  }

  const handleSuspend = async (creator: CreatorRow) => {
    if (!window.confirm(`Заблокировать Creator-а ${creator.email}?`)) return
    try {
      await adminApi.suspendCreator(creator.id)
      load(search, status, page)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg === 'cannot_suspend_self' ? 'Нельзя заблокировать самого себя' : 'Ошибка при блокировке')
    }
  }

  const handleActivate = async (creator: CreatorRow) => {
    if (!window.confirm(`Разблокировать Creator-а ${creator.email}?`)) return
    try {
      await adminApi.activateCreator(creator.id)
      load(search, status, page)
    } catch {
      alert('Ошибка при разблокировке')
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Creator-ы</h1>

      {/* Фильтры */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Поиск по email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
        />
        <select
          value={status}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="suspended">Заблокированные</option>
        </select>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Загрузка...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500 text-sm mb-3">Ошибка загрузки</p>
            <button onClick={() => load(search, status, page)} className="px-4 py-2 bg-rose-600 text-white text-sm rounded-xl hover:bg-rose-700 transition-colors">
              Повторить
            </button>
          </div>
        ) : !data?.creators.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">Нет Creator-ов</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Имя</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Статус</th>
                <th className="text-right px-5 py-3 text-slate-500 font-medium">Инстансы</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Дата регистрации</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.creators.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-slate-700 font-medium">{c.email}</td>
                  <td className="px-5 py-3 text-slate-600">{c.name || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3 text-right text-slate-600">{c.instances_count ?? 0}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(c.inserted_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.status === 'active' ? (
                      <button
                        onClick={() => handleSuspend(c)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        Заблокировать
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(c)}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        Разблокировать
                      </button>
                    )}
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
