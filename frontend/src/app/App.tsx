import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'
import { useEndUserAuthStore } from '@/features/auth/endUserAuthStore'
import { connectSocket, disconnectSocket } from '@/shared/lib/socket'

// Страницы платформы (Creator)
import { HomePage } from '@/pages/platform/HomePage'
import { LoginPage } from '@/pages/platform/auth/LoginPage'
import { RegisterPage } from '@/pages/platform/auth/RegisterPage'
import { BuilderPage } from '@/pages/platform/BuilderPage'

// Дашборд Creator-а (новый layout с sidebar)
import { DashboardLayout } from '@/pages/dashboard/DashboardLayout'
import { DashboardOverviewPage } from '@/pages/dashboard/overview/DashboardOverviewPage'
import { DashboardAnalyticsPage } from '@/pages/dashboard/analytics/DashboardAnalyticsPage'
import { DashboardSettingsPage } from '@/pages/dashboard/settings/DashboardSettingsPage'
import { DashboardPlansPage } from '@/pages/dashboard/plans/DashboardPlansPage'

// Admin-панель (Super Admin)
import { AdminLayout, AdminRoute } from '@/pages/admin/AdminLayout'
import { AdminOverviewPage } from '@/pages/admin/overview/AdminOverviewPage'
import { AdminCreatorsPage } from '@/pages/admin/creators/AdminCreatorsPage'
import { AdminInstancesPage } from '@/pages/admin/instances/AdminInstancesPage'
import { AdminAiUsagePage } from '@/pages/admin/ai-usage/AdminAiUsagePage'

// Страницы чат-инстанса (End User)
import { ChatLandingPage } from '@/pages/chat/landing/ChatLandingPage'
import { ChatLoginPage } from '@/pages/chat/auth/ChatLoginPage'
import { ChatRegisterPage } from '@/pages/chat/auth/ChatRegisterPage'
import { ConversationPage } from '@/pages/chat/conversation/ConversationPage'
import { SubscriptionSuccessPage } from '@/pages/chat/subscription/SubscriptionSuccessPage'
import { SubscriptionCancelPage } from '@/pages/chat/subscription/SubscriptionCancelPage'

// AuthRoute для Creator-а: авторизованный пользователь → /dashboard
function CreatorAuthRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCreatorAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

/**
 * Определяет, открыт ли сайт на субдомене чат-инстанса.
 * Субдомен есть если хост вида: {subdomain}.localhost или {subdomain}.chatforge.app
 * Чистый localhost или chatforge.app — платформа.
 * Dev-fallback: ?subdomain=test в URL (для окружений где test.localhost не резолвится)
 */
function isChatSubdomain(): boolean {
  const host = window.location.hostname
  const parts = host.split('.')
  // {subdomain}.localhost → 2 части
  if (parts.length === 2 && parts[1] === 'localhost') return true
  // {subdomain}.chatforge.app → 3 части
  if (parts.length === 3 && parts[1] === 'chatforge' && parts[2] === 'app') return true
  // Dev-fallback: ?subdomain=xxx в URL
  const params = new URLSearchParams(window.location.search)
  if (params.get('subdomain')) return true
  return false
}

export function App() {
  const endUserToken = useEndUserAuthStore((s) => s.accessToken)
  const isEndUserAuthenticated = useEndUserAuthStore((s) => s.isAuthenticated)

  // Подключаем/отключаем Phoenix Socket при изменении аутентификации End User-а
  useEffect(() => {
    if (isEndUserAuthenticated && endUserToken) {
      connectSocket(endUserToken)
    } else {
      disconnectSocket()
    }
  }, [isEndUserAuthenticated, endUserToken])

  // На субдомене чат-инстанса — рендерим только чат-роуты
  if (isChatSubdomain()) {
    return (
      <Routes>
        <Route path="/" element={<ChatLandingPage />} />
        <Route path="/login" element={<ChatLoginPage />} />
        <Route path="/register" element={<ChatRegisterPage />} />
        <Route path="/chat" element={<ConversationPage />} />
        <Route path="/chat/:id" element={<ConversationPage />} />
        <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
        <Route path="/subscription/cancel" element={<SubscriptionCancelPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {/* Лендинг платформы — главная страница */}
      <Route path="/" element={<HomePage />} />

      {/* Маршруты аутентификации Creator-а (редирект если уже авторизован) */}
      <Route
        path="/login"
        element={
          <CreatorAuthRoute>
            <LoginPage />
          </CreatorAuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <CreatorAuthRoute>
            <RegisterPage />
          </CreatorAuthRoute>
        }
      />

      {/* /builder — публичный, авторизация запрашивается внутри при финализации */}
      <Route path="/builder" element={<BuilderPage />} />

      {/* /dashboard — layout с sidebar, вложенные страницы */}
      <Route
        path="/dashboard"
        element={<DashboardLayout />}
      >
        <Route index element={<DashboardOverviewPage />} />
        <Route path="analytics" element={<DashboardAnalyticsPage />} />
        <Route path="settings" element={<DashboardSettingsPage />} />
        <Route path="plans" element={<DashboardPlansPage />} />
      </Route>

      {/* /admin — Admin-панель, только super_admin */}
      <Route
        path="/admin"
        element={<AdminRoute><AdminLayout /></AdminRoute>}
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="creators" element={<AdminCreatorsPage />} />
        <Route path="instances" element={<AdminInstancesPage />} />
        <Route path="ai-usage" element={<AdminAiUsagePage />} />
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* Маршруты чат-инстанса (End User) — legacy /chat/* пути             */}
      {/* ------------------------------------------------------------------ */}
      <Route path="/chat/hello" element={<ChatLandingPage />} />
      <Route path="/chat/login" element={<ChatLoginPage />} />
      <Route path="/chat/register" element={<ChatRegisterPage />} />
      <Route path="/chat" element={<ConversationPage />} />
      <Route path="/chat/subscription/success" element={<SubscriptionSuccessPage />} />
      <Route path="/chat/subscription/cancel" element={<SubscriptionCancelPage />} />
      <Route path="/chat/:id" element={<ConversationPage />} />
    </Routes>
  )
}
