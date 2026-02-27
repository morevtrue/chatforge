// Лендинг чат-инстанса — публичная страница с инфо об AI-ассистенте
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEndUserAuthStore } from '@/features/auth/endUserAuthStore'
import { useChatStore } from '@/features/chat/chatStore'
import { chatRoutes } from '@/shared/lib/chatRoutes'

export function ChatLandingPage() {
  const navigate = useNavigate()
  const isAuthenticated = useEndUserAuthStore((s) => s.isAuthenticated)
  const { instanceInfo, instanceLoading, fetchInstanceInfo } = useChatStore()

  useEffect(() => {
    fetchInstanceInfo()
  }, [fetchInstanceInfo])

  // Если уже авторизован — сразу в чат
  useEffect(() => {
    if (isAuthenticated) {
      navigate(chatRoutes.chat(), { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleStartChat = () => {
    if (isAuthenticated) {
      navigate(chatRoutes.chat())
    } else {
      navigate(chatRoutes.login())
    }
  }

  const handleExampleQuestion = (question: string) => {
    const encoded = encodeURIComponent(question)
    if (isAuthenticated) {
      navigate(`${chatRoutes.chat()}?question=${encoded}`)
    } else {
      navigate(`${chatRoutes.login()}?question=${encoded}`)
    }
  }

  if (instanceLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="w-full max-w-lg px-6 animate-pulse">
          {/* Skeleton аватар */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-20 h-20 rounded-full bg-indigo-200" />
            <div className="h-7 w-48 rounded-xl bg-indigo-200" />
            <div className="h-4 w-72 rounded-lg bg-indigo-100" />
          </div>
          {/* Skeleton кнопки */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-indigo-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!instanceInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <p className="text-gray-500">Не удалось загрузить информацию о чате</p>
      </div>
    )
  }

  const primaryColor = instanceInfo.primary_color ?? '#6366f1'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
      {/* Blob-фон */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: primaryColor }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: primaryColor }}
        />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 flex flex-col items-center gap-6">
          {/* Аватар */}
          {instanceInfo.avatar_url ? (
            <img
              src={instanceInfo.avatar_url}
              alt={instanceInfo.name}
              className="w-20 h-20 rounded-full object-cover shadow-md"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md"
              style={{ background: primaryColor }}
            >
              {instanceInfo.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Название */}
          <h1 className="text-2xl font-bold text-gray-900 text-center">{instanceInfo.name}</h1>

          {/* Приветствие */}
          {instanceInfo.greeting_text && (
            <p className="text-gray-600 text-center text-sm leading-relaxed">
              {instanceInfo.greeting_text}
            </p>
          )}

          {/* Примеры вопросов */}
          {instanceInfo.example_questions.length > 0 && (
            <div className="w-full space-y-2">
              <p className="text-xs text-gray-400 text-center uppercase tracking-wide">
                Попробуйте спросить
              </p>
              {instanceInfo.example_questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleQuestion(q)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-indigo-100 bg-indigo-50/50 text-sm text-gray-700 hover:bg-indigo-100 hover:border-indigo-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Кнопка начать */}
          <button
            onClick={handleStartChat}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm shadow-md hover:opacity-90 transition-opacity"
            style={{ background: primaryColor }}
          >
            Начать чат
          </button>

          {/* Ссылки регистрации/входа */}
          {!isAuthenticated && (
            <p className="text-xs text-gray-400">
              Нет аккаунта?{' '}
              <button
                onClick={() => navigate('/chat/register')}
                className="text-indigo-600 hover:underline"
              >
                Зарегистрироваться
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
