// Страница регистрации Creator-а
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'

const schema = z
  .object({
    email: z.string().email('Введите корректный email'),
    name: z.string().min(1, 'Введите имя'),
    password: z.string().min(8, 'Пароль должен быть не менее 8 символов'),
    confirmPassword: z.string().min(1, 'Повторите пароль'),
    phone: z.string().optional(),
    telegram: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const registerCreator = useCreatorAuthStore((s) => s.register)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await registerCreator({
        email: data.email,
        name: data.name,
        password: data.password,
        phone: data.phone || undefined,
        telegram: data.telegram || undefined,
      })
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { errors?: Record<string, string[]> } } })?.response
      if (response?.status === 422 && response.data?.errors) {
        // Серверные ошибки валидации — показываем рядом с полями
        const serverErrors = response.data.errors
        Object.entries(serverErrors).forEach(([field, messages]) => {
          setError(field as keyof FormData, { message: messages[0] })
        })
      } else {
        setError('root', { message: 'Ошибка сервера. Попробуйте позже.' })
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Регистрация в ChatForge</h1>

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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Повторите пароль *
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Телефон (необязательно)
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              {...register('phone')}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="telegram" className="block text-sm font-medium text-gray-700 mb-1">
              Telegram (необязательно)
            </label>
            <input
              id="telegram"
              type="text"
              placeholder="@username"
              {...register('telegram')}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

        <p className="mt-4 text-center text-sm text-gray-600">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
