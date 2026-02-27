// Главная страница чата — сайдбар + диалог
// Единственная страница для End User после логина
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useEndUserAuthStore } from '@/features/auth/endUserAuthStore'
import { useChatStore } from '@/features/chat/chatStore'
import { useThemeStore } from '@/features/chat/themeStore'
import { useChat } from '@/features/chat/hooks/useChat'
import { disconnectSocket } from '@/shared/lib/socket'
import { useBillingStore } from '@/features/billing/billingStore'
import { Paywall } from '@/shared/ui/Paywall'
import { chatRoutes } from '@/shared/lib/chatRoutes'
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function formatConvDate(iso: string) {
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Вчера'
  if (diff < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' })
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
function formatDateSep(iso: string) {
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
function needsSep(prev: string | null, curr: string) {
  if (!prev) return true
  return new Date(prev).toDateString() !== new Date(curr).toDateString()
}

export function ConversationPage() {
  const { id: rawId } = useParams<{ id: string }>()
  // Защита: если id не UUID (например субдомен попал в :id) — игнорируем
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const id = rawId && UUID_REGEX.test(rawId) ? rawId : undefined
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAuthenticated = useEndUserAuthStore((s) => s.isAuthenticated)
  const instanceInfo = useChatStore((s) => s.instanceInfo)
  const messagesLoading = useChatStore((s) => s.messagesLoading)
  const conversations = useChatStore((s) => s.conversations)
  const conversationsLoading = useChatStore((s) => s.conversationsLoading)
  const fetchMessages = useChatStore((s) => s.fetchMessages)
  const fetchInstanceInfo = useChatStore((s) => s.fetchInstanceInfo)
  const fetchConversations = useChatStore((s) => s.fetchConversations)
  const createConversation = useChatStore((s) => s.createConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const logout = useEndUserAuthStore((s) => s.logout)
  const currentEndUser = useEndUserAuthStore((s) => s.currentEndUser)
  const resetChat = useChatStore((s) => s.reset)
  const { isDark, toggle: toggleTheme } = useThemeStore()

  const paywallOpen = useBillingStore((s) => s.paywallOpen)
  const openPaywall = useBillingStore((s) => s.openPaywall)
  const closePaywall = useBillingStore((s) => s.closePaywall)
  const currentSubscription = useBillingStore((s) => s.currentSubscription)
  const subscriptionLoading = useBillingStore((s) => s.subscriptionLoading)
  const fetchCurrentSubscription = useBillingStore((s) => s.fetchCurrentSubscription)

  const handleLogout = async () => {
    disconnectSocket()
    resetChat()
    await logout()
    navigate(chatRoutes.login())
  }

  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // isSending: true с момента отправки до прихода первого чанка (показывает лоадер)
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isAtBottomRef = useRef(true)

  const { messages, sendMessage, isStreaming, isLimitReached } = useChat(id ?? '')

  // Сбрасываем isSending когда стриминг начался или завершился
  useEffect(() => {
    if (isStreaming || messages.some(m => m.isStreaming)) {
      setIsSending(false)
    }
  }, [isStreaming, messages])

  // Открываем Paywall при достижении лимита
  useEffect(() => {
    if (isLimitReached) {
      openPaywall()
    }
  }, [isLimitReached, openPaywall])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchInstanceInfo()
    fetchConversations()
    fetchCurrentSubscription()
  }, [isAuthenticated])

  // Обрабатываем ?question= из URL — создаём диалог и сразу отправляем вопрос
  useEffect(() => {
    const question = searchParams.get('question')
    if (!question || !isAuthenticated || id) return

    const autoStart = async () => {
      try {
        const conv = await createConversation()
        navigate(`${chatRoutes.conversation(conv.id)}?question=${encodeURIComponent(question)}`, { replace: true })
      } catch {
        // ignore
      }
    }
    autoStart()
  }, [isAuthenticated, searchParams, id])

  // Обновляем подписку при возврате на вкладку (после редиректа на страницу оплаты)
  useEffect(() => {
    if (!isAuthenticated) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchCurrentSubscription()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isAuthenticated, fetchCurrentSubscription])

  useEffect(() => {
    if (!isAuthenticated || !id) return
    fetchMessages(id)
  }, [id, isAuthenticated])

  // Когда диалог загружен и есть ?question= — отправляем сообщение автоматически
  useEffect(() => {
    const question = searchParams.get('question')
    if (!question || !id || !isAuthenticated) return
    // Ждём загрузки сообщений, потом отправляем
    if (messagesLoading) return
    sendMessage(decodeURIComponent(question))
    // Убираем параметр из URL чтобы не отправить повторно при рефреше
    navigate(chatRoutes.conversation(id!), { replace: true })
  }, [id, isAuthenticated, messagesLoading])

  useEffect(() => {
    if (isAtBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => { setSidebarOpen(false) }, [id])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }, [])

  if (!isAuthenticated) return <Navigate to={chatRoutes.login()} replace />

  const handleSend = () => {
    const content = input.trim()
    if (!content || isStreaming || isSending || isLimitReached) return
    setIsSending(true)
    sendMessage(content)
    setInput('')
    isAtBottomRef.current = true
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
  }

  const handleNewChat = async () => {
    setCreating(true)
    try { const conv = await createConversation(); navigate(chatRoutes.conversation(conv.id)) }
    finally { setCreating(false) }
  }

  const handleDelete = async (convId: string) => {
    setDeletingId(convId)
    try {
      await deleteConversation(convId)
      if (convId === id) navigate(chatRoutes.chat())
    } finally { setDeletingId(null); setConfirmDeleteId(null) }
  }

  // Цвета из настроек инстанса
  const primary = instanceInfo?.primary_color ?? '#6366f1'
  const bgColor = instanceInfo?.background_color
  const avatarUrl = instanceInfo?.avatar_url
  const botName = instanceInfo?.name ?? 'AI'

  // Лоадер: показывается сразу после отправки (isSending) или пока стриминг идёт без контента
  const streamingMsg = messages.find(m => m.isStreaming)
  const showTypingLoader = isSending || (isStreaming && (!streamingMsg || streamingMsg.content === ''))

  // Тёмная тема
  const darkBg = '#0f1117'
  const darkSurface = '#1a1d27'
  const darkBorder = '#2a2d3a'
  const darkText = '#e8eaf0'
  const darkSubtext = '#8b8fa8'

  const theme = {
    bg: isDark ? darkBg : (bgColor ?? '#f8fafc'),
    surface: isDark ? darkSurface : '#ffffff',
    border: isDark ? darkBorder : 'rgba(0,0,0,0.08)',
    text: isDark ? darkText : '#111827',
    subtext: isDark ? darkSubtext : '#6b7280',
    // Пузырь ассистента — светлый с primary-оттенком
    aiBubbleBg: isDark ? '#1e2130' : `${primary}18`,
    aiBubbleText: isDark ? darkText : '#111827',
    // Пузырь пользователя — светлый с border
    userBubbleBg: isDark ? `${primary}25` : `${primary}15`,
    userBubbleBorder: isDark ? `${primary}40` : `${primary}30`,
    userBubbleText: isDark ? darkText : '#111827',
    inputBg: isDark ? '#1e2130' : '#ffffff',
    inputBorder: isDark ? darkBorder : 'rgba(0,0,0,0.12)',
    sidebarBg: isDark ? darkSurface : '#ffffff',
    sidebarActiveBg: isDark ? `${primary}22` : `${primary}12`,
    sidebarActiveText: primary,
    sidebarHoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    // Шапка — primary цвет как в превью визарда
    headerBg: primary,
    headerText: '#ffffff',
    gradientBg: isDark
      ? `linear-gradient(135deg, ${darkBg} 0%, #12151f 100%)`
      : (bgColor ?? '#f8fafc'),
  }

  const BotAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const cls = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
    return avatarUrl
      ? <img src={avatarUrl} alt={botName} className={`${cls} rounded-xl object-cover flex-shrink-0`} />
      : <div className={`${cls} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0`} style={{ background: 'rgba(255,255,255,0.25)' }}>{botName.charAt(0).toUpperCase()}</div>
  }

  const Spinner = ({ cls = 'w-4 h-4' }: { cls?: string }) => (
    <svg className={`${cls} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )

  const ThemeIcon = () => isDark
    ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
    : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: theme.gradientBg, color: theme.text }}>

      {/* Оверлей мобильного сайдбара */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Сайдбар ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-30 flex flex-col transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:z-auto lg:flex-shrink-0 lg:h-full
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: theme.sidebarBg, borderRight: `1px solid ${theme.border}` }}
      >
        {/* Шапка сайдбара — primary цвет */}
        <div className="flex items-center gap-2.5 px-3 py-3.5 min-h-[56px] flex-shrink-0" style={{ background: theme.headerBg }}>
          <BotAvatar />
          <span className="font-semibold text-sm flex-1 truncate text-white">{botName}</span>
          <button onClick={toggleTheme}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff' }}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}>
            <ThemeIcon />
          </button>
          <button onClick={handleNewChat} disabled={creating}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}
            title="Новый диалог">
            {creating ? <Spinner cls="w-3.5 h-3.5" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
          </button>
        </div>

        {/* Список диалогов */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {conversationsLoading ? (
            <div className="space-y-1 px-2 pt-1 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-11 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />)}
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-center py-8 px-4" style={{ color: theme.subtext }}>Нет диалогов</p>
          ) : (
            <div className="px-1.5 space-y-0.5">
              {conversations.map((conv) => (
                <div key={conv.id} className="group relative rounded-xl transition-all"
                  style={{ background: conv.id === id ? theme.sidebarActiveBg : 'transparent' }}>
                  <button className="w-full text-left px-2.5 py-2.5 pr-8 rounded-xl transition-colors"
                    style={{ color: conv.id === id ? theme.sidebarActiveText : theme.text }}
                    onMouseEnter={e => { if (conv.id !== id) (e.currentTarget as HTMLElement).style.background = theme.sidebarHoverBg }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    onClick={() => navigate(chatRoutes.conversation(conv.id))}>                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-medium truncate flex-1">{conv.title}</p>
                      <span className="text-[10px] flex-shrink-0" style={{ color: theme.subtext }}>{formatConvDate(conv.updated_at)}</span>
                    </div>
                  </button>
                  {confirmDeleteId === conv.id ? (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-1 rounded-lg z-10"
                      style={{ background: theme.sidebarBg, border: `1px solid ${theme.border}` }}>
                      <button onClick={() => handleDelete(conv.id)} disabled={deletingId === conv.id}
                        className="text-[10px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50">
                        {deletingId === conv.id ? '...' : 'Да'}
                      </button>
                      <span style={{ color: theme.subtext }} className="text-[10px]">/</span>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[10px]" style={{ color: theme.subtext }}>Нет</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(conv.id)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: theme.subtext }}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Блок статуса подписки */}
        <div className="px-3 py-2.5 flex-shrink-0" style={{ borderTop: `1px solid ${theme.border}` }}>
          {subscriptionLoading ? (
            // Skeleton-загрузчик
            <div className="animate-pulse rounded-xl px-3 py-2.5 h-14" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
          ) : currentSubscription ? (
            // Активная подписка
            <div className="rounded-xl px-3 py-2.5" style={{ background: isDark ? `${primary}18` : `${primary}10`, border: `1px solid ${primary}30` }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: primary }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-[11px] font-semibold truncate" style={{ color: primary }}>{currentSubscription.plan.name}</p>
              </div>
              <p className="text-[10px]" style={{ color: theme.subtext }}>
                до {new Date(currentSubscription.expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                {currentSubscription.plan.message_limit !== null && (
                  <span> · {currentSubscription.plan.message_limit} сообщ.</span>
                )}
                {currentSubscription.plan.message_limit === null && (
                  <span> · Безлимит</span>
                )}
              </p>
            </div>
          ) : (
            // Нет подписки — бесплатный план
            <div className="rounded-xl px-3 py-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme.border}` }}>
              <p className="text-[11px] font-medium" style={{ color: theme.subtext }}>Бесплатный план</p>
              {isLimitReached ? (
                <p className="text-[10px] mt-0.5 text-yellow-500">Лимит исчерпан</p>
              ) : (
                <p className="text-[10px] mt-0.5" style={{ color: theme.subtext }}>
                  Использовано: {currentEndUser?.messages_used ?? 0} сообщ.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Блок профиля + выход */}
        <div className="px-3 py-3 flex-shrink-0 min-h-[88px] flex flex-col justify-center" style={{ borderTop: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: primary }}>
              {(currentEndUser?.email ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: theme.text }}>{currentEndUser?.email ?? 'Пользователь'}</p>
              <p className="text-[10px]" style={{ color: theme.subtext }}>End User</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90 active:scale-95"
            style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Выйти
          </button>
        </div>
      </aside>

      {/* ── Основная область ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Шапка — primary цвет как в превью визарда */}
        <header className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0 min-h-[56px]"
          style={{ background: theme.headerBg }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1 -ml-1 rounded-lg transition-colors text-white"
            aria-label="Меню">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <BotAvatar />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate text-white">{botName}</p>
            <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {isStreaming ? 'печатает...' : '● Онлайн'}
            </p>
          </div>
          <button onClick={toggleTheme}
            className="hidden lg:flex w-8 h-8 rounded-xl items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff' }}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}>
            <ThemeIcon />
          </button>
          <button onClick={handleNewChat} disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
            {creating ? <Spinner cls="w-3.5 h-3.5" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
            <span className="hidden sm:inline">Новый чат</span>
          </button>
        </header>

        {/* Контент */}
        {!id ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
              style={{ background: `${primary}18` }}>
              <svg className="w-8 h-8" style={{ color: primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="font-semibold mb-1" style={{ color: theme.text }}>Выберите диалог</p>
            <p className="text-sm mb-5" style={{ color: theme.subtext }}>или начните новый</p>
            <button onClick={handleNewChat} disabled={creating}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              style={{ background: primary }}>
              {creating ? 'Создаём...' : 'Новый диалог'}
            </button>
          </div>
        ) : (
          <>
            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto px-4 py-4" onScroll={handleScroll}>
              {messagesLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[{r:'assistant',w:'w-64'},{r:'user',w:'w-48'},{r:'assistant',w:'w-72'},{r:'user',w:'w-32'}].map((item,i) => (
                    <div key={i} className={`flex gap-2 ${item.r === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {item.r === 'assistant' && <div className="w-7 h-7 rounded-xl flex-shrink-0 mt-1" style={{ background: `${primary}20` }} />}
                      <div className={`h-10 ${item.w} rounded-2xl`} style={{ background: `${primary}12` }} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col pt-4 px-2">
                  {/* Приветственное сообщение — как обычный пузырь ассистента */}
                  <div className="flex gap-2 justify-start mb-3">
                    <div className="flex-shrink-0 mt-1 w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: primary }}>
                      {avatarUrl
                        ? <img src={avatarUrl} alt={botName} className="w-7 h-7 rounded-xl object-cover" />
                        : botName.charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="flex flex-col items-start max-w-[75%]">
                      <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed"
                        style={{ background: theme.aiBubbleBg, color: theme.aiBubbleText }}>
                        {instanceInfo?.greeting_text ?? 'Привет! Чем могу помочь?'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((msg, idx) => {
                    const prevDate = idx > 0 ? messages[idx-1].inserted_at : null
                    const showSep = needsSep(prevDate, msg.inserted_at)
                    return (
                      <div key={msg.id}>
                        {showSep && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px" style={{ background: theme.border }} />
                            <span className="text-[11px] font-medium px-2" style={{ color: theme.subtext }}>{formatDateSep(msg.inserted_at)}</span>
                            <div className="flex-1 h-px" style={{ background: theme.border }} />
                          </div>
                        )}
                        <div className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-1`}>
                          {msg.role === 'assistant' && (
                            <div className="flex-shrink-0 mt-1 w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: primary }}>
                              {avatarUrl
                                ? <img src={avatarUrl} alt={botName} className="w-7 h-7 rounded-xl object-cover" />
                                : botName.charAt(0).toUpperCase()
                              }
                            </div>
                          )}
                          <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[75%]`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                              style={msg.role === 'user'
                                ? { background: theme.userBubbleBg, color: theme.userBubbleText, border: `1px solid ${theme.userBubbleBorder}` }
                                : { background: theme.aiBubbleBg, color: theme.aiBubbleText }
                              }>
                              {msg.role === 'assistant' ? (
                                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1" style={{ color: theme.aiBubbleText }}>
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                  {msg.isStreaming && <span className="inline-block w-1.5 h-4 animate-pulse ml-0.5 align-middle rounded-sm" style={{ background: primary }} />}
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              )}
                            </div>
                            {!msg.isStreaming && <span className="text-[10px] mt-1 px-1" style={{ color: theme.subtext }}>{formatTime(msg.inserted_at)}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Лоадер "печатает..." — показывается сразу после отправки */}
              {showTypingLoader && (
                <div className="flex gap-2 justify-start mt-2">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1"
                    style={{ background: primary }}>
                    {avatarUrl ? <img src={avatarUrl} alt={botName} className="w-7 h-7 rounded-xl object-cover" /> : botName.charAt(0).toUpperCase()}
                  </div>
                  <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: theme.aiBubbleBg }}>
                    <div className="flex gap-1 items-center h-4">
                      {[0,160,320].map(delay => (
                        <span key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: primary, animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Paywall-баннер при лимите */}
            {isLimitReached && !paywallOpen && (
              <div className="mx-4 mb-2 flex-shrink-0">
                <button
                  onClick={openPaywall}
                  className="w-full px-4 py-3 rounded-xl text-sm text-center transition-all hover:opacity-90"
                  style={{ background: isDark ? 'rgba(251,191,36,0.1)' : '#fffbeb', border: '1px solid rgba(251,191,36,0.4)', color: isDark ? '#fbbf24' : '#92400e' }}
                >
                  Вы достигли лимита — нажмите, чтобы оформить подписку
                </button>
              </div>
            )}

            {/* Подсказки — показываются только когда нет сообщений */}
            {messages.length === 0 && instanceInfo?.example_questions && instanceInfo.example_questions.length > 0 && (
              <div className="px-4 pb-2 flex flex-col gap-1.5 items-end flex-shrink-0">
                {instanceInfo.example_questions.map((q, i) => (
                  <button key={i}
                    onClick={() => { setIsSending(true); sendMessage(q) }}
                    disabled={isStreaming || isSending || isLimitReached}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80 active:scale-95 disabled:opacity-40 text-right"
                    style={{ background: theme.userBubbleBg, color: theme.userBubbleText, border: `1px solid ${theme.userBubbleBorder}` }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Поле ввода */}
            <div className="px-4 py-3 flex-shrink-0 min-h-[88px] flex flex-col justify-center" style={{ background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
              <div className="flex gap-2 items-end">
                <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
                  disabled={isStreaming || isSending || isLimitReached || paywallOpen}
                  placeholder={isLimitReached ? 'Оформите подписку для продолжения' : 'Напишите сообщение...'}
                  rows={1}
                  className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm focus:outline-none transition-shadow disabled:opacity-50 disabled:cursor-not-allowed overflow-y-hidden"
                  style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.text, lineHeight: '1.5', minHeight: '42px', maxHeight: '128px' }}
                  onFocus={e => e.target.style.border = `1px solid ${primary}`}
                  onBlur={e => e.target.style.border = `1px solid ${theme.inputBorder}`}
                />
                <button onClick={handleSend} disabled={!input.trim() || isStreaming || isSending || isLimitReached || paywallOpen}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 active:scale-95"
                  style={{ background: primary }} aria-label="Отправить">
                  {isStreaming || isSending ? <Spinner /> : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[11px] mt-1.5 text-center" style={{ color: theme.subtext }}>Enter — отправить · Shift+Enter — перенос</p>
            </div>
          </>
        )}
      </div>

      {/* Paywall — рендерится поверх всего при открытии */}
      {paywallOpen && (
        <Paywall
          theme={theme}
          primary={primary}
          isDark={isDark}
          onClose={closePaywall}
        />
      )}
    </div>
  )
}
