// Шаг 2 визарда — название чата, валюта, поддомен
// Проверка поддомена через API (нужна для валидации), но сохранение — только в store

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/shared/ui/button'
import { useBuilderStore } from '../store'
import { builderApi } from '../api'
import type { Currency } from '../types'

interface Step2NameProps {
  onNext: () => void
  onBack: () => void
}

const CURRENCIES: Array<{ value: Currency; label: string; flag: string }> = [
  { value: 'RUB', label: 'Рубль', flag: '🇷🇺' },
  { value: 'USD', label: 'Доллар', flag: '🇺🇸' },
  { value: 'EUR', label: 'Евро', flag: '🇪🇺' },
]

function toSubdomain(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

type SubdomainStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid_format' | 'error'

export function Step2Name({ onNext, onBack }: Step2NameProps) {
  const { name, currency, setNameAndCurrency, setStep } = useBuilderStore()
  const [localName, setLocalName] = useState(name)
  const [localCurrency, setLocalCurrency] = useState<Currency>(currency)
  const [subdomainStatus, setSubdomainStatus] = useState<SubdomainStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const subdomain = toSubdomain(localName)

  // Debounce-проверка поддомена (только валидация, не сохранение)
  useEffect(() => {
    if (!subdomain) { setSubdomainStatus('idle'); return }
    setSubdomainStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await builderApi.validateSubdomain(subdomain)
        setSubdomainStatus(res.data.available ? 'available' : (res.data.reason ?? 'taken'))
      } catch {
        setSubdomainStatus('error')
      }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [subdomain])

  // Обновляем store в реальном времени для превью
  useEffect(() => {
    setNameAndCurrency(localName, localCurrency)
  }, [localName, localCurrency, setNameAndCurrency])

  const statusConfig: Record<SubdomainStatus, { text: string | null; color: string; icon: string }> = {
    idle: { text: null, color: '', icon: '' },
    checking: { text: 'Проверяем доступность...', color: 'text-slate-400', icon: '⏳' },
    available: { text: 'Поддомен доступен', color: 'text-emerald-600', icon: '✓' },
    taken: { text: 'Поддомен уже занят', color: 'text-red-500', icon: '✗' },
    invalid_format: { text: 'Только строчные буквы, цифры и дефис', color: 'text-red-500', icon: '✗' },
    error: { text: 'Не удалось проверить', color: 'text-slate-400', icon: '?' },
  }

  const canProceed = localName.trim().length > 0 && subdomain.length > 0 && subdomainStatus === 'available'

  const handleNext = () => {
    if (!canProceed) return
    setNameAndCurrency(localName.trim(), localCurrency)
    setStep(3)
    onNext()
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Название и валюта</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Задайте название и выберите валюту для оплаты</p>
      </div>

      {/* Name input */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Название чата</label>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          placeholder="Например: Мой помощник"
          className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          maxLength={100}
        />
      </div>

      {/* Subdomain preview */}
      {subdomain && (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Адрес чата</label>
          <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700/50 overflow-hidden">
            <span className="px-3 py-3 text-sm text-slate-400 bg-slate-100 dark:bg-slate-700 border-r border-slate-200 dark:border-slate-600 whitespace-nowrap">https://</span>
            <span className="px-3 py-3 text-sm font-mono font-semibold text-slate-800 dark:text-slate-100 flex-1">{subdomain}</span>
            <span className="px-3 py-3 text-sm text-slate-400 bg-slate-100 dark:bg-slate-700 border-l border-slate-200 dark:border-slate-600 whitespace-nowrap">.chatforge.app</span>
          </div>
          {statusConfig[subdomainStatus].text && (
            <p className={`text-xs flex items-center gap-1 ${statusConfig[subdomainStatus].color}`}>
              <span>{statusConfig[subdomainStatus].icon}</span>
              {statusConfig[subdomainStatus].text}
            </p>
          )}
        </div>
      )}

      {/* Currency */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Валюта</label>
        <div className="grid grid-cols-3 gap-3">
          {CURRENCIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setLocalCurrency(c.value)}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                localCurrency === c.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <span>{c.flag}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => { setStep(1); onBack() }} className="rounded-xl border-slate-200">
          ← Назад
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white border-0 px-6 rounded-xl disabled:opacity-40"
        >
          Далее →
        </Button>
      </div>
    </div>
  )
}
