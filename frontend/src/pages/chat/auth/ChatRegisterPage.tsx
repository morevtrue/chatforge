// Страница регистрации End User-а
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { chatAuthApi } from '@/features/auth/api'
import { useEndUserAuthStore } from '@/features/auth/endUserAuthStore'
import { chatRoutes } from '@/shared/lib/chatRoutes'

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  name: z.string().min(1, 'Введите имя'),
  password: z.string().min(8, 'Пароль должен быть не менее 8 символов'),
})

type FormData = z.infer<typeof schema>

export function ChatRegisterPage() {
  const navigate = useNavigate()
  const setEndUser = useEndUserAuthStore((s) => s.setEndUser)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const response = await chatAuthApi.register(data)
      const { end_user, access_token, refresh_token } = response.data
      setEndUser(end_user, access_token, refresh_token)
      navigate(chatRoutes.chat(), { replace: true })
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { errors?: Record<string, string[] | string> } } })?.response
      if ((response?.status === 422 || response?.status === 400) && response.data?.errors) {
        const serverErrors = response.data.errors
        Object.entries(serverErrors).forEach(([field, messages]) => {
          const msg = Array.isArray(messages) ? messages[0] : messages
          // Локализуем типичные серверные ошибки
          const localized = msg === 'has already been taken' ? 'Этот email уже зарегистрирован' : msg
          setError(field as keyof FormData, { message: localized })
        })
      } else {
        setError('root', { message: 'Ошибка сервера. Попробуйте позже.' })
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Регистрация в чате</h1>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Имя *
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register('name')}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Пароль *
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-xs text-red-600 text-center">{errors.root.message}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          Уже есть аккаунт?{' '}
          <button
            type="button"
            onClick={() => navigate(chatRoutes.login())}
            className="text-blue-600 hover:underline font-medium"
          >
            Войти
          </button>
        </p>
      </div>
    </div>
  )
}
