// Страница списка диалогов End User-а
// Защищённый маршрут — редирект на /chat/login если не аутентифицирован
import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useEndUserAuthStore } from '@/features/auth/endUserAuthStore'
import { useChatStore } from '@/features/chat/chatStore'

export function ConversationsPage() {
  const navigate = useNavigate()
  const isAuthenticated = useEndUserAuthStore((s) => s.isAuthenticated)
  const {
    conversations,
    conversationsLoading,
    conversationsError,
    instanceInfo,
    fetchConversations,
    createConversation,
    deleteConversation,
    fetchInstanceInfo,
  } = useChatStore()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations()
      if (!instanceInfo) fetchInstanceInfo()
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return <Navigate to="/chat/login" replace />
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const conv = await createConversation()
      navigate(`/chat/${conv.id}`)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteConversation(id)
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Вчера'
    if (diffDays < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' })
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }

  const primaryColor = instanceInfo?.primary_color ?? '#6366f1'
  const avatarUrl = instanceInfo?.avatar_url
  const botName = instanceInfo?.name ?? 'AI'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/40">
      {/* Декоративные блобы */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-[0.07] blur-3xl bg-indigo-500" />
        <div className="absolute top-1/2 -left-24 w-64 h-64 rounded-full opacity-[0.05] blur-3xl bg-purple-500" />
        <div className="absolute -bottom-32 right-1/3 w-72 h-72 rounded-full opacity-[0.06] blur-3xl bg-violet-400" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 min-h-screen flex flex-col">
        {/* Шапка */}
        <div className="flex items-center gap-3 mb-6">
          {/* Аватар бота */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={botName} className="w-10 h-10 rounded-2xl object-cover shadow-sm" />
            ) : (
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-sm"
                style={{ background: primaryColor }}
              >
                {botName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{botName}</h1>
            <p className="text-xs text-gray-400">Диалоги</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            style={{ background: primaryColor }}
          >
            {creating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Новый
          </button>
        </div>

        {/* Контент */}
        {conversationsLoading ? (
          <div className="space-y-2.5 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[72px] rounded-2xl bg-white/70" />
            ))}
          </div>
        ) : conversationsError ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm mb-3">{conversationsError}</p>
            <button
              onClick={() => fetchConversations()}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: primaryColor }}
            >
              Повторить
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-sm"
              style={{ background: `${primaryColor}18` }}
            >
              <svg className="w-8 h-8" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-700 font-semibold mb-1">Начните общение</p>
            <p className="text-gray-400 text-sm mb-5">Создайте первый диалог с {botName}</p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              style={{ background: primaryColor }}
            >
              Начать диалог
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Иконка диалога */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${primaryColor}15` }}
                  >
                    <svg className="w-4 h-4" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>

                  {/* Текст */}
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => navigate(`/chat/${conv.id}`)}
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">{conv.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(conv.updated_at)}</p>
                  </button>

                  {/* Удаление */}
                  {confirmId === conv.id ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">Удалить?</span>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        disabled={deletingId === conv.id}
                        className="text-xs text-red-500 hover:text-red-600 font-semibold disabled:opacity-50"
                      >
                        Да
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(conv.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-1"
                      aria-label="Удалить диалог"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
