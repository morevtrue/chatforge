// Страница дашборда Creator-а

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { dashboardApi } from './api'
import { InstanceCard } from './components/InstanceCard'
import { SettingsPanel } from './components/SettingsPanel'
import { DashboardPlansPage } from '@/pages/dashboard/plans/DashboardPlansPage'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import type { ChatInstance } from '@/features/builder/types'

// Вкладки правой колонки
type RightTab = 'settings' | 'plans'

type PageState = 'loading' | 'loaded' | 'no_instance' | 'error'

export function DashboardPage() {
  const [pageState, setPageState] = useState<PageState>('loading')
  const [instances, setInstances] = useState<ChatInstance[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('settings')
  const { currentUser, logout } = useCreatorAuthStore()

  useEffect(() => {
    let cancelled = false
    dashboardApi.getInstances()
      .then((res) => {
        if (cancelled) return
        const list = res.data.chat_instances
        if (list.length === 0) {
          setPageState('no_instance')
        } else {
          setInstances(list)
          setSelectedId(list[0].id)
          setPageState('loaded')
        }
      })
      .catch(() => { if (!cancelled) setPageState('error') })
    return () => { cancelled = true }
  }, [])

  const handleInstanceUpdated = (updated: ChatInstance) => {
    setInstances(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (pageState === 'no_instance') return <Navigate to="/builder" replace />

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50 dark:from-slate-950 dark:to-red-950/20">
        <div className="text-center space-y-3">
          <div className="text-4xl">😕</div>
          <p className="text-slate-700 dark:text-slate-300 font-medium">Не удалось загрузить данные</p>
          <button onClick={() => window.location.reload()} className="text-sm text-indigo-600 hover:underline">
            Обновить страницу
          </button>
        </div>
      </div>
    )
  }

  const selectedInstance = instances.find(i => i.id === selectedId) ?? instances[0]
  const userInitial = currentUser?.name?.charAt(0).toUpperCase() ?? currentUser?.email?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-200/20 dark:bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-16 w-72 h-72 bg-purple-200/15 dark:bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">C</div>
            <span className="font-semibold text-slate-800 dark:text-slate-100">ChatForge</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {userInitial}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-tight">{currentUser?.name ?? currentUser?.email}</p>
                {currentUser?.name && <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">{currentUser.email}</p>}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-100 dark:hover:border-red-900"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Title + create button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Дашборд</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Управляйте вашими чат-инстансами</p>
          </div>
          <a
            href="/builder"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Новый чат
          </a>
        </div>

        {/* Instances list */}
        {instances.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ваши чаты</p>
            <div className="flex flex-wrap gap-2">
              {instances.map(inst => (
                <button
                  key={inst.id}
                  onClick={() => setSelectedId(inst.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    inst.id === selectedId
                      ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-200 dark:hover:border-indigo-800'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: inst.settings?.primary_color ?? '#6366f1' }}
                  >
                    {inst.name.charAt(0).toUpperCase()}
                  </div>
                  {inst.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main content: selected instance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left */}
          <div className="lg:col-span-1 space-y-4">
            <InstanceCard instance={selectedInstance} />

            {/* Info */}
            <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Информация</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Валюта</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{selectedInstance.currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Бесплатных сообщений</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {selectedInstance.free_messages_limit === null ? '∞' : selectedInstance.free_messages_limit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Поддомен</span>
                  <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">{selectedInstance.subdomain}</span>
                </div>
              </div>
            </div>

            <a
              href={selectedInstance.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Открыть чат
            </a>
          </div>

          {/* Right: settings / plans */}
          <div className="lg:col-span-2 space-y-4">
            {/* Вкладки */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              <button
                onClick={() => setRightTab('settings')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  rightTab === 'settings'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Настройки
              </button>
              <button
                onClick={() => setRightTab('plans')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  rightTab === 'plans'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Планы
              </button>
            </div>

            {/* Содержимое вкладки */}
            {rightTab === 'settings' ? (
              <SettingsPanel
                key={selectedInstance.id}
                instance={selectedInstance}
                onUpdated={handleInstanceUpdated}
              />
            ) : (
              <DashboardPlansPage key={selectedInstance.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
