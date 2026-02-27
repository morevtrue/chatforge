// Layout Admin-панели — отдельный от DashboardLayout
import { useState } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'

// ── Guard ────────────────────────────────────────────────────────────────────

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentUser } = useCreatorAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (currentUser?.role !== 'super_admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// ── Иконки ───────────────────────────────────────────────────────────────────

function IconOverview() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconInstances() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

function IconAI() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

// ── Навигация ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Обзор',      path: '/admin',           icon: <IconOverview />,   exact: true },
  { label: 'Creator-ы',  path: '/admin/creators',  icon: <IconUsers /> },
  { label: 'Инстансы',   path: '/admin/instances', icon: <IconInstances /> },
  { label: 'AI Usage',   path: '/admin/ai-usage',  icon: <IconAI /> },
]

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { currentUser, logout } = useCreatorAuthStore()

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="px-5 py-5 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">A</div>
          <div>
            <p className="font-semibold text-slate-800 text-sm leading-tight">ChatForge</p>
            <p className="text-xs text-rose-500 font-medium leading-tight">Super Admin</p>
          </div>
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
                  ? 'bg-rose-50 text-rose-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Профиль + выход */}
      <div className="px-3 py-4 border-t border-slate-200/80 space-y-2">
        <div className="px-3 py-2">
          <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          <IconLogout />
          Выйти
        </button>
      </div>
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — десктоп */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white border-r border-slate-200/80 sticky top-0 h-screen">
        <Sidebar />
      </aside>

      {/* Overlay + Sidebar — мобильный */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-56 bg-white h-full shadow-xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200/80 px-6 py-3 flex items-center gap-4">
          <button
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Открыть меню"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="text-sm font-medium text-slate-500">Панель администратора</span>
        </header>

        <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
