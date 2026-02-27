// Страница управления тарифными планами Creator-а
// Инстанс берётся из контекста DashboardLayout (multi-instance)

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useBillingStore } from '@/features/billing/billingStore'
import { createPlan, updatePlan, deactivatePlan } from '@/features/billing/api'
import { useInstance } from '@/pages/dashboard/DashboardLayout'
import type { SubscriptionPlan } from '@/features/billing/types'

// Начальное состояние формы
const emptyForm = {
  name: '',
  price: '',
  period: 'monthly' as 'monthly' | 'yearly',
  message_limit: '',
}

type FormData = typeof emptyForm

export function DashboardPlansPage() {
  const { instance } = useInstance()
  const { plans, plansLoading, fetchPlansByInstance, fetchPlans } = useBillingStore()

  const doFetchPlans = () => {
    if (instance) {
      fetchPlansByInstance(instance.id)
    } else {
      fetchPlans()
    }
  }

  // Режим формы: null — скрыта, 'create' — создание, id плана — редактирование
  const [formMode, setFormMode] = useState<null | 'create' | string>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [formLoading, setFormLoading] = useState(false)

  // id плана, ожидающего подтверждения деактивации
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Загрузить планы при монтировании или смене инстанса
  useEffect(() => {
    doFetchPlans()
  }, [instance?.id])

  // Открыть форму создания
  const openCreate = () => {
    setForm(emptyForm)
    setFormMode('create')
  }

  // Открыть форму редактирования с предзаполненными данными
  const openEdit = (plan: SubscriptionPlan) => {
    setForm({
      name: plan.name,
      price: plan.price,
      period: plan.period,
      message_limit: plan.message_limit !== null ? String(plan.message_limit) : '',
    })
    setFormMode(plan.id)
  }

  // Закрыть форму
  const closeForm = () => {
    setFormMode(null)
    setForm(emptyForm)
  }

  // Обработка отправки формы (создание или редактирование)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const payload: Partial<SubscriptionPlan> = {
        name: form.name.trim(),
        price: form.price,
        period: form.period,
        message_limit: form.message_limit.trim() === '' ? null : Number(form.message_limit),
      }

      if (formMode === 'create') {
        await createPlan(payload, instance?.id)
        toast.success('Тарифный план создан')
      } else if (formMode) {
        await updatePlan(formMode, payload)
        toast.success('Тарифный план обновлён')
      }

      closeForm()
      await doFetchPlans()
    } catch {
      toast.error('Не удалось сохранить план. Попробуйте ещё раз.')
    } finally {
      setFormLoading(false)
    }
  }

  // Подтвердить деактивацию плана
  const handleDeactivate = async (id: string) => {
    setDeactivating(true)
    try {
      await deactivatePlan(id)
      toast.success('План деактивирован')
      setConfirmDeactivate(null)
      await doFetchPlans()
    } catch {
      toast.error('Не удалось деактивировать план. Попробуйте ещё раз.')
    } finally {
      setDeactivating(false)
    }
  }

  // Форматирование периода для отображения
  const formatPeriod = (period: 'monthly' | 'yearly') =>
    period === 'monthly' ? 'в месяц' : 'в год'

  // Форматирование лимита сообщений
  const formatLimit = (limit: number | null) =>
    limit === null ? 'Безлимит' : `${limit} сообщений`

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
      {/* Заголовок */}
      <div className="px-7 py-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Тарифные планы</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Управляйте планами монетизации вашего чата</p>
        </div>
        {formMode === null && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Создать план
          </button>
        )}
      </div>

      <div className="px-7 py-6 space-y-5">
        {/* Форма создания / редактирования */}
        {formMode !== null && (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl p-5 space-y-4"
          >
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {formMode === 'create' ? 'Новый тарифный план' : 'Редактировать план'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Название */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Название <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Базовый"
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all"
                />
              </div>

              {/* Цена */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Цена <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="299.00"
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all"
                />
              </div>

              {/* Период */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Период</label>
                <select
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as 'monthly' | 'yearly' }))}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all"
                >
                  <option value="monthly">Ежемесячно</option>
                  <option value="yearly">Ежегодно</option>
                </select>
              </div>

              {/* Лимит сообщений */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Лимит сообщений{' '}
                  <span className="text-slate-400 font-normal">(пусто = безлимит)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.message_limit}
                  onChange={(e) => setForm((f) => ({ ...f, message_limit: e.target.value }))}
                  placeholder="500"
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all"
                />
              </div>
            </div>

            {/* Кнопки формы */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={formLoading}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 disabled:opacity-60"
              >
                {formLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  formMode === 'create' ? 'Создать' : 'Сохранить'
                )}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={formLoading}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-slate-300 transition-all disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </form>
        )}

        {/* Skeleton-загрузчик */}
        {plansLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Пустое состояние */}
        {!plansLoading && plans.length === 0 && formMode === null && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl">
              💳
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Создайте первый тарифный план
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Тарифные планы позволяют монетизировать доступ к вашему чату
            </p>
            <button
              onClick={openCreate}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Создать план
            </button>
          </div>
        )}

        {/* Список планов */}
        {!plansLoading && plans.length > 0 && (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl px-5 py-4"
              >
                {/* Информация о плане */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {plan.name}
                    </span>
                    {/* Статус активности */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        plan.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {plan.is_active ? 'Активен' : 'Деактивирован'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    {/* Цена и период */}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {plan.price} ₽ {formatPeriod(plan.period)}
                    </span>
                    <span>·</span>
                    {/* Лимит */}
                    <span>{formatLimit(plan.message_limit)}</span>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Кнопка редактирования */}
                  <button
                    onClick={() => openEdit(plan)}
                    disabled={formMode !== null}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-40"
                  >
                    Редактировать
                  </button>

                  {/* Кнопка деактивации (только для активных планов) */}
                  {plan.is_active && (
                    confirmDeactivate === plan.id ? (
                      // Подтверждение деактивации
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Уверены?</span>
                        <button
                          onClick={() => handleDeactivate(plan.id)}
                          disabled={deactivating}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {deactivating ? '...' : 'Да'}
                        </button>
                        <button
                          onClick={() => setConfirmDeactivate(null)}
                          disabled={deactivating}
                          className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 transition-all disabled:opacity-50"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeactivate(plan.id)}
                        disabled={formMode !== null}
                        className="px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40"
                      >
                        Деактивировать
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
