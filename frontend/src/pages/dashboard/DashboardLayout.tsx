// Layout дашборда Creator-а
// Multi-instance: список инстансов, селектор, кнопка "Создать ещё один чат"
// Контекст выбранного инстанса передаётся дочерним страницам

import { useState, useEffect, createContext, useContext } from 'react'
import { NavLink, Outlet, useLocation, Navigate, Link } from 'react-router-dom'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { dashboardApi } from '@/features/dashboard/api'
import type { ChatInstance } from '@/features/builder/types'

// =========================================================================
// Контекст выбранного инстанса
// =========================================================================

interface InstanceContextValue {
  instance: ChatInstance | null
  instances: ChatInstance[]
  setInstance: (inst: ChatInstance) => void
}

export const InstanceContext = createContext<InstanceContextValue>({
  instance: null,
  instances: [],
  setInstance: () => {},
})

export function useInstance() {
  return useContext(InstanceContext)
}

// =========================================================================
// Иконки навигации
// =========================================================================

function IconOverview() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

function IconAnalytics() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function IconPlans() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

// =========================================================================
// Конфигурация навигации
// =========================================================================

const NAV_ITEMS = [
  { label: 'Обзор',     path: '/dashboard',            icon: <IconOverview />,  exact: true },
  { label: 'Аналитика', path: '/dashboard/analytics',  icon: <IconAnalytics /> },
  { label: 'Настройки', path: '/dashboard/settings',   icon: <IconSettings /> },
  { label: 'Тарифы',    path: '/dashboard/plans',      icon: <IconPlans /> },
]

// =========================================================================
// Хлебные крошки
// =========================================================================

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard':            'Обзор',
  '/dashboard/analytics':  'Аналитика',
  '/dashboard/settings':   'Настройки',
  '/dashboard/plans':      'Тарифы',
}

function Breadcrumbs() {
  const location = useLocation()
  const label = BREADCRUMB_MAP[location.pathname] ?? 'Дашборд'

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400 dark:text-slate-500">Дашборд</span>
      {label !== 'Обзор' && (
        <>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">{label}</span>
        </>
      )}
    </div>
  )
}

// =========================================================================
// Селектор инстанса
// =========================================================================

interface InstanceSelectorProps {
  instances: ChatInstance[]
  current: ChatInstance
  onChange: (inst: ChatInstance) => void
}

function InstanceSelector({ instances, current, onChange }: InstanceSelectorProps) {
  const [open, setOpen] = useState(false)

  if (instances.length <= 1) {
    return (
      <div className="px-3 py-2 mb-1">
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {current.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{current.name}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 mb-1 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {current.name.charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate text-left">{current.name}</span>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <IconChevron />
        </span>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {instances.map((inst) => (
            <button
              key={inst.id}
              onClick={() => { onChange(inst); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                inst.id === current.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {inst.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{inst.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// =========================================================================
// Sidebar
// =========================================================================

interface SidebarProps {
  instances: ChatInstance[]
  currentInstance: ChatInstance
  onInstanceChange: (inst: ChatInstance) => void
  onClose?: () => void
}

function Sidebar({ instances, currentInstance, onInstanceChange, onClose }: SidebarProps) {
  const { currentUser, logout } = useCreatorAuthStore()
  const userInitial = currentUser?.name?.charAt(0).toUpperCase() ?? currentUser?.email?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="flex flex-col h-full">
      {/* Логотип */}
      <div className="px-5 py-5 border-b border-slate-200/80 dark:border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">C</div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">ChatForge</span>
        </div>
      </div>

      {/* Селектор инстанса */}
      <div className="pt-3 border-b border-slate-200/80 dark:border-slate-700/60 pb-2">
        <InstanceSelector
          instances={instances}
          current={currentInstance}
          onChange={onInstanceChange}
        />
        {/* Кнопка создать ещё один чат */}
        <div className="px-3 pb-2">
          <Link
            to="/builder"
            onClick={onClose}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
          >
            <IconPlus />
            Создать ещё один чат
          </Link>
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Профиль + выход */}
      <div className="px-3 py-4 border-t border-slate-200/80 dark:border-slate-700/60 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate leading-tight">
              {currentUser?.name ?? currentUser?.email}
            </p>
            {currentUser?.name && (
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate leading-tight">{currentUser.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
        >
          <IconLogout />
          Выйти
        </button>
      </div>
    </div>
  )
}

// =========================================================================
// Layout
// =========================================================================

export function DashboardLayout() {
  const isAuthenticated = useCreatorAuthStore((s) => s.isAuthenticated)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'empty'>('loading')
  const [instances, setInstances] = useState<ChatInstance[]>([])
  const [currentInstance, setCurrentInstance] = useState<ChatInstance | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    dashboardApi.getInstances()
      .then((res) => {
        const list = res.data.chat_instances ?? []
        if (list.length === 0) {
          setLoadState('empty')
        } else {
          setInstances(list)
          setCurrentInstance(list[0])
          setLoadState('ready')
        }
      })
      .catch(() => {
        // При ошибке сети — показываем дашборд, не редиректим
        setLoadState('ready')
      })
  }, [isAuthenticated])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (loadState === 'empty') return <Navigate to="/builder" replace />

  return (
    <InstanceContext.Provider value={{
      instance: currentInstance,
      instances,
      setInstance: setCurrentInstance,
    }}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 flex">

        {/* Sidebar — десктоп */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200/80 dark:border-slate-700/60 sticky top-0 h-screen">
          {loadState === 'ready' && currentInstance && (
            <Sidebar
              instances={instances}
              currentInstance={currentInstance}
              onInstanceChange={setCurrentInstance}
            />
          )}
        </aside>

        {/* Overlay + Sidebar — мобильный */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <aside className="relative z-50 w-60 bg-white dark:bg-slate-900 h-full shadow-xl">
              {loadState === 'ready' && currentInstance && (
                <Sidebar
                  instances={instances}
                  currentInstance={currentInstance}
                  onInstanceChange={setCurrentInstance}
                  onClose={() => setSidebarOpen(false)}
                />
              )}
            </aside>
          </div>
        )}

        {/* Основной контент */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Шапка */}
          <header className="sticky top-0 z-10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-700/80 px-6 py-3 flex items-center justify-between gap-4">
            {/* Hamburger (мобильный) */}
            <button
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Открыть меню"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <Breadcrumbs />

            <div className="flex items-center gap-3">
              {/* Кнопка открытия чата */}
              {currentInstance && (
                <a
                  href={(import.meta.env.VITE_CHAT_BASE_URL ?? 'http://localhost:5173/?subdomain={subdomain}').replace('{subdomain}', currentInstance.subdomain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-medium rounded-xl hover:opacity-90 transition-opacity shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Открыть чат
                </a>
              )}
              <ThemeToggle />
            </div>
          </header>

          {/* Страница */}
          <main className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">
            {loadState === 'loading' ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </InstanceContext.Provider>
  )
}
