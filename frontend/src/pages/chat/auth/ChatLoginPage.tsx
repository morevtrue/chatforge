// Страница входа End User-а
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useEndUserAuthStore } from '@/features/auth/endUserAuthStore'
import { chatRoutes } from '@/shared/lib/chatRoutes'

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

type FormData = z.infer<typeof schema>

export function ChatLoginPage() {
  const navigate = useNavigate()
  const login = useEndUserAuthStore((s) => s.login)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await login(data)
      navigate(chatRoutes.chat(), { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        setError('email', { message: 'Неверный email или пароль' })
        setError('password', { message: 'Неверный email или пароль' })
      } else {
        setError('root', { message: 'Ошибка сервера. Попробуйте позже.' })
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Вход в чат</h1>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
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
            {isSubmitting ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          Нет аккаунта?{' '}
          <button
            type="button"
            onClick={() => navigate(chatRoutes.register())}
            className="text-blue-600 hover:underline font-medium"
          >
            Зарегистрироваться
          </button>
        </p>
      </div>
    </div>
  )
}
