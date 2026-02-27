// Шаг 4 визарда — лимит бесплатных сообщений

import { Button } from '@/shared/ui/button'
import { useBuilderStore } from '../store'
import { useState } from 'react'

interface Step4LimitProps {
  onFinalizeRequest: () => void
  onBack: () => void
}

const PRESETS = [
  { value: 10, label: '10', desc: 'Для знакомства' },
  { value: 50, label: '50', desc: 'Стандартно' },
  { value: 100, label: '100', desc: 'Щедро' },
]

export function Step4Limit({ onFinalizeRequest, onBack }: Step4LimitProps) {
  const { freeMessagesLimit, setLimit, setStep } = useBuilderStore()
  const [isUnlimited, setIsUnlimited] = useState(freeMessagesLimit === null)
  const [localLimit, setLocalLimit] = useState<number>(freeMessagesLimit ?? 50)

  const selectUnlimited = () => {
    setIsUnlimited(true)
    setLimit(null)
  }

  const selectLimited = () => {
    setIsUnlimited(false)
    setLimit(localLimit)
  }

  const handlePreset = (value: number) => {
    setLocalLimit(value)
    setLimit(value)
  }

  const handleCustomLimit = (value: number) => {
    const clamped = Math.max(1, Math.min(10000, value))
    setLocalLimit(clamped)
    setLimit(clamped)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Лимит сообщений</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Сколько сообщений пользователь получает бесплатно</p>
      </div>

      {/* Mode selection */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={selectUnlimited}
          className={`flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all text-center ${
            isUnlimited
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
          }`}
        >
          <span className="text-2xl">♾️</span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Без лимита</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Бесплатно для всех</p>
          </div>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
            isUnlimited ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-500'
          }`}>
            {isUnlimited && (
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </button>

        <button
          onClick={selectLimited}
          className={`flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all text-center ${
            !isUnlimited
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
          }`}
        >
          <span className="text-2xl">💬</span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">С лимитом</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Задать количество</p>
          </div>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
            !isUnlimited ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-500'
          }`}>
            {!isUnlimited && (
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Limit presets + custom — только если выбран режим с лимитом */}
      {!isUnlimited && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all ${
                  localLimit === p.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{p.label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.desc}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Или введите своё значение</label>
            <input
              type="number"
              value={localLimit}
              onChange={(e) => handleCustomLimit(parseInt(e.target.value) || 1)}
              min={1}
              max={10000}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-slate-50 dark:bg-slate-700/50"
            />
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => { setStep(3); onBack() }} className="rounded-xl">
          ← Назад
        </Button>
        <Button
          onClick={onFinalizeRequest}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white border-0 px-6 rounded-xl"
        >
          Создать чат ✓
        </Button>
      </div>
    </div>
  )
}
