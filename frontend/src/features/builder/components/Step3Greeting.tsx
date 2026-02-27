// Шаг 3 визарда — аватар (drag & drop), текст приветствия, примеры вопросов
// Аватар загружается на сервер сразу (нужен URL для превью и финализации)
// Остальное — только в store, без API

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { useBuilderStore } from '../store'
import { builderApi } from '../api'

interface Step3GreetingProps {
  onNext: () => void
  onBack: () => void
}

export function Step3Greeting({ onNext, onBack }: Step3GreetingProps) {
  const { greetingText, exampleQuestions, avatarUrl, setGreeting, setAvatar, setStep } = useBuilderStore()

  const [localGreeting, setLocalGreeting] = useState(greetingText)
  const [localQuestions, setLocalQuestions] = useState<string[]>(
    exampleQuestions.length > 0 ? exampleQuestions : ['']
  )
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(avatarUrl)
  const [isDragging, setIsDragging] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Синхронизируем превью в реальном времени
  useEffect(() => {
    setGreeting(localGreeting, localQuestions.filter(q => q.trim()))
  }, [localGreeting, localQuestions, setGreeting])

  // Аватар загружается сразу — нужен URL для финализации
  const handleFile = useCallback(async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { setAvatarError('Допустимые форматы: JPEG, PNG, WebP'); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Файл не должен превышать 5 МБ'); return }
    setAvatarError(null)
    setIsUploadingAvatar(true)
    try {
      const res = await builderApi.uploadAvatar(file)
      setLocalAvatarUrl(res.data.avatar_url)
      setAvatar(res.data.avatar_url)
    } catch {
      setAvatarError('Не удалось загрузить аватар.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }, [setAvatar])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleNext = () => {
    setGreeting(localGreeting, localQuestions.filter(q => q.trim().length > 0))
    setStep(4)
    onNext()
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Приветствие и аватар</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Настройте первое впечатление от вашего чата</p>
      </div>

      {/* Avatar upload */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Аватар чата</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]' : 'border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
          }`}
        >
          {localAvatarUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img src={localAvatarUrl} alt="Аватар" className="w-16 h-16 rounded-full object-cover ring-4 ring-indigo-100" />
              <span className="text-xs text-slate-400">Нажмите или перетащите для замены</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {isUploadingAvatar ? (
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl">📷</div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Перетащите или нажмите для выбора</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">JPEG, PNG, WebP — до 5 МБ</p>
                </>
              )}
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {avatarError && <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span>{avatarError}</p>}
      </div>

      {/* Greeting text */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Текст приветствия</label>
        <textarea
          value={localGreeting}
          onChange={(e) => setLocalGreeting(e.target.value)}
          placeholder="Привет! Я ваш AI-помощник. Чем могу помочь?"
          rows={3}
          maxLength={1000}
          className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 text-right">{localGreeting.length}/1000</p>
      </div>

      {/* Example questions */}
      <div className="space-y-2">
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Примеры вопросов</label>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">До 5 подсказок для пользователей</p>
        </div>
        <div className="space-y-2">
          {localQuestions.map((q, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-slate-400 dark:text-slate-500 w-4 text-center">{idx + 1}</span>
              <input
                type="text"
                value={q}
                onChange={(e) => setLocalQuestions(prev => prev.map((x, i) => i === idx ? e.target.value : x))}
                placeholder={`Вопрос ${idx + 1}`}
                className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                maxLength={200}
              />
              {localQuestions.length > 1 && (
                <button
                  onClick={() => setLocalQuestions(prev => prev.filter((_, i) => i !== idx))}
                  className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex items-center justify-center text-lg leading-none"
                >×</button>
              )}
            </div>
          ))}
        </div>
        {localQuestions.length < 5 && (
          <button
            onClick={() => setLocalQuestions(prev => [...prev, ''])}
            className="text-sm text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Добавить вопрос
          </button>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => { setStep(2); onBack() }} className="rounded-xl border-slate-200">
          ← Назад
        </Button>
        <Button
          onClick={handleNext}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white border-0 px-6 rounded-xl"
        >
          Далее →
        </Button>
      </div>
    </div>
  )
}
