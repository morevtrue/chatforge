// Модалка авторизации внутри визарда
// Показывается при попытке финализировать чат без авторизации
// После успешного входа/регистрации вызывает onSuccess()

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'

interface AuthGateModalProps {
  onSuccess: () => void
  onClose: () => void
}

const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

const registerSchema = z.object({
  email: z.string().email('Введите корректный email'),
  name: z.string().min(1, 'Введите имя'),
  password: z.string().min(8, 'Минимум 8 символов'),
  confirmPassword: z.string().min(1, 'Повторите пароль'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
})

type LoginData = z.infer<typeof loginSchema>
type RegisterData = z.infer<typeof registerSchema>

export function AuthGateModal({ onSuccess, onClose }: AuthGateModalProps) {
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const { login, register: registerCreator } = useCreatorAuthStore()

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) })

  const handleLogin = async (data: LoginData) => {
    try {
      await login(data)
      onSuccess()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      loginForm.setError('root', {
        message: status === 401 ? 'Неверный email или пароль' : 'Ошибка сервера. Попробуйте позже.',
      })
    }
  }

  const handleRegister = async (data: RegisterData) => {
    try {
      await registerCreator({ email: data.email, name: data.name, password: data.password })
      onSuccess()
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: { errors?: Record<string, string[]> } } })?.response
      if (res?.status === 422 && res.data?.errors) {
        Object.entries(res.data.errors).forEach(([field, messages]) => {
          registerForm.setError(field as keyof RegisterData, { message: messages[0] })
        })
      } else {
        registerForm.setError('root', { message: 'Ошибка сервера. Попробуйте позже.' })
      }
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-slate-50 hover:bg-white'
  const errorCls = 'mt-1 text-xs text-red-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">Почти готово! 🎉</h2>
              <p className="text-white/80 text-sm mt-0.5">
                Создайте аккаунт, чтобы сохранить ваш чат
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-xl leading-none mt-0.5"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-white/10 rounded-xl p-1">
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              Регистрация
            </button>
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              Уже есть аккаунт
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {mode === 'register' ? (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} noValidate className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Ваше имя"
                  {...registerForm.register('name')}
                  className={inputCls}
                />
                {registerForm.formState.errors.name && (
                  <p className={errorCls}>{registerForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  {...registerForm.register('email')}
                  className={inputCls}
                />
                {registerForm.formState.errors.email && (
                  <p className={errorCls}>{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Пароль (минимум 8 символов)"
                  autoComplete="new-password"
                  {...registerForm.register('password')}
                  className={inputCls}
                />
                {registerForm.formState.errors.password && (
                  <p className={errorCls}>{registerForm.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  {...registerForm.register('confirmPassword')}
                  className={inputCls}
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className={errorCls}>{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              {registerForm.formState.errors.root && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {registerForm.formState.errors.root.message}
                </p>
              )}
              <button
                type="submit"
                disabled={registerForm.formState.isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {registerForm.formState.isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Создаём аккаунт...
                  </span>
                ) : 'Создать аккаунт и сохранить чат'}
              </button>
            </form>
          ) : (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} noValidate className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  {...loginForm.register('email')}
                  className={inputCls}
                />
                {loginForm.formState.errors.email && (
                  <p className={errorCls}>{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Пароль"
                  autoComplete="current-password"
                  {...loginForm.register('password')}
                  className={inputCls}
                />
                {loginForm.formState.errors.password && (
                  <p className={errorCls}>{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              {loginForm.formState.errors.root && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {loginForm.formState.errors.root.message}
                </p>
              )}
              <button
                type="submit"
                disabled={loginForm.formState.isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {loginForm.formState.isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Входим...
                  </span>
                ) : 'Войти и сохранить чат'}
              </button>
            </form>
          )}

          <p className="text-xs text-slate-400 text-center mt-4">
            Ваши настройки чата сохранятся после входа
          </p>
        </div>
      </div>
    </div>
  )
}
