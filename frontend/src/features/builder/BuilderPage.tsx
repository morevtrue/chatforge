// Контейнер визарда создания чата
// Шаги 1-4 работают без авторизации (только локальный store)
// Авторизация запрашивается только при финализации (шаг 4 → "Создать чат")
// После авторизации — автоматически финализируем через API

import { useState } from 'react'
import { useBuilderStore } from './store'
import { Step1Colors } from './components/Step1Colors'
import { Step2Name } from './components/Step2Name'
import { Step3Greeting } from './components/Step3Greeting'
import { Step4Limit } from './components/Step4Limit'
import { ChatPreview } from './components/ChatPreview'
import { AuthGateModal } from './components/AuthGateModal'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { builderApi } from './api'
import type { ChatInstance } from './types'

type PageState = 'wizard' | 'finalizing' | 'done' | 'error'

const STEPS = [
  { num: 1, label: 'Цвета', icon: '🎨' },
  { num: 2, label: 'Название', icon: '✏️' },
  { num: 3, label: 'Приветствие', icon: '👋' },
  { num: 4, label: 'Лимит', icon: '⚡' },
]

export function BuilderPage() {
  const { currentStep, setStep, reset, colors, name, currency, greetingText, exampleQuestions, freeMessagesLimit } = useBuilderStore()
  const isAuthenticated = useCreatorAuthStore(s => s.isAuthenticated)

  const [pageState, setPageState] = useState<PageState>('wizard')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [createdInstance, setCreatedInstance] = useState<ChatInstance | null>(null)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

  // Финализация: вызывается после авторизации (или сразу если уже авторизован)
  const finalize = async () => {
    setPageState('finalizing')
    setFinalizeError(null)
    try {
      // Сначала стартуем визард (идемпотентно), потом сохраняем все шаги
      await builderApi.startWizard()
      await builderApi.updateStep(1, {
        primary_color: colors.primaryColor,
        secondary_color: colors.secondaryColor,
        background_color: colors.backgroundColor,
      })
      await builderApi.updateStep(2, {
        name,
        subdomain: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        currency,
      })
      await builderApi.updateStep(3, {
        greeting_text: greetingText,
        example_questions: exampleQuestions,
      })
      await builderApi.updateStep(4, {
        free_messages_limit: freeMessagesLimit,
      })
      const res = await builderApi.finalize()
      setCreatedInstance(res.data.chat_instance)
      reset()
      setPageState('done')
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setFinalizeError(code === 'incomplete_wizard'
        ? 'Не все шаги заполнены. Вернитесь назад и проверьте данные.'
        : 'Не удалось создать чат. Попробуйте ещё раз.')
      setPageState('wizard')
    }
  }

  // Вызывается из Step4Limit когда пользователь нажимает "Создать чат"
  const handleFinalizeRequest = () => {
    if (isAuthenticated) {
      finalize()
    } else {
      setShowAuthModal(true)
    }
  }

  // После успешной авторизации в модалке
  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    finalize()
  }

  if (pageState === 'finalizing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">Создаём ваш чат...</p>
        </div>
      </div>
    )
  }

  if (pageState === 'done' && createdInstance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
        <div className="max-w-md w-full mx-auto p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-lg">
            🎉
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Чат создан!</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{createdInstance.name}</span> готов к работе
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Адрес вашего чата</p>
            <a
              href={createdInstance.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline break-all text-sm"
            >
              {createdInstance.public_url}
            </a>
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-md"
          >
            Перейти в дашборд →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 bg-purple-200/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-sky-200/20 rounded-full blur-3xl" />
        <div className="absolute top-2/3 left-10 w-48 h-48 bg-pink-200/20 rounded-full blur-2xl" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#6366f1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              C
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-100">ChatForge</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-slate-400 dark:text-slate-500">Создание чата</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((step, idx) => (
            <div key={step.num} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    step.num < currentStep
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                      : step.num === currentStep
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-300 scale-110'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.num < currentStep ? '✓' : step.icon}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:block transition-colors ${
                    step.num === currentStep ? 'text-indigo-600' : step.num < currentStep ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 rounded transition-colors duration-500 ${step.num < currentStep ? 'bg-indigo-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Form */}
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm shadow-slate-100 p-8">
            {finalizeError && (
              <div className="mb-6 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span>⚠️</span> {finalizeError}
              </div>
            )}
            {currentStep === 1 && <Step1Colors onNext={() => {}} />}
            {currentStep === 2 && <Step2Name onNext={() => {}} onBack={() => {}} />}
            {currentStep === 3 && <Step3Greeting onNext={() => {}} onBack={() => {}} />}
            {currentStep === 4 && (
              <Step4Limit
                onFinalizeRequest={handleFinalizeRequest}
                onBack={() => setStep(3)}
              />
            )}
          </div>

          {/* Right: Live preview */}
          <div className="lg:sticky lg:top-24">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 text-center">
              Превью чата
            </p>
            <ChatPreview />
          </div>
        </div>
      </div>

      {/* Auth gate modal */}
      {showAuthModal && (
        <AuthGateModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  )
}
