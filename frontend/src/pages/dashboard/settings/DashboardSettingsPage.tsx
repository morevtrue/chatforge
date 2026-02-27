// Страница настроек чата Creator-а
// Три секции: Внешний вид, Контент, AI — с превью в реальном времени
// Инстанс берётся из контекста DashboardLayout (multi-instance)

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { dashboardApi } from '@/features/dashboard/api'
import { useInstance } from '@/pages/dashboard/DashboardLayout'
import type { ChatInstance } from '@/features/builder/types'

// =========================================================================
// Мини-превью чата
// =========================================================================

interface PreviewProps {
  primaryColor: string
  backgroundColor: string
  avatarUrl: string | null
  greetingText: string
  exampleQuestions: string[]
  name: string
}

function ChatPreview({ primaryColor, backgroundColor, avatarUrl, greetingText, exampleQuestions, name }: PreviewProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col"
      style={{ backgroundColor, minHeight: 360 }}
    >
      {/* Шапка */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: primaryColor }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white text-sm font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-white text-sm font-semibold truncate">{name}</span>
      </div>

      {/* Тело */}
      <div className="flex-1 p-4 space-y-3">
        {greetingText && (
          <div className="flex gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
            ) : (
              <div className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: primaryColor }}>
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-slate-700 dark:text-slate-200 shadow-sm max-w-[80%]">
              {greetingText}
            </div>
          </div>
        )}

        {exampleQuestions.filter(Boolean).length > 0 && (
          <div className="space-y-1.5 mt-2">
            {exampleQuestions.filter(Boolean).slice(0, 3).map((q, i) => (
              <button
                key={i}
                className="w-full text-left text-xs px-3 py-2 rounded-xl border transition-colors"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Инпут */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2">
          <span className="text-xs text-slate-400 flex-1">Введите сообщение...</span>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// Основная страница
// =========================================================================

export function DashboardSettingsPage() {
  const { instance: ctxInstance, setInstance } = useInstance()
  const [instance, setLocalInstance] = useState<ChatInstance | null>(ctxInstance)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Поля формы
  const [primaryColor, setPrimaryColor] = useState('#6366F1')
  const [secondaryColor, setSecondaryColor] = useState('#8B5CF6')
  const [backgroundColor, setBackgroundColor] = useState('#F8FAFC')
  const [greetingText, setGreetingText] = useState('')
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([''])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [freeLimit, setFreeLimit] = useState<number>(10)

  // Синхронизируем форму при смене инстанса в контексте
  useEffect(() => {
    if (!ctxInstance) return
    setLocalInstance(ctxInstance)
    const s = ctxInstance.settings
    if (s) {
      setPrimaryColor(s.primary_color ?? '#6366F1')
      setSecondaryColor(s.secondary_color ?? '#8B5CF6')
      setBackgroundColor(s.background_color ?? '#F8FAFC')
      setGreetingText(s.greeting_text ?? '')
      setExampleQuestions(s.example_questions?.length ? s.example_questions : [''])
      setSystemPrompt(s.system_prompt ?? '')
    }
    setFreeLimit(ctxInstance.free_messages_limit ?? 10)
  }, [ctxInstance?.id])

  const handleSave = async () => {
    if (!instance) return
    setSaving(true)
    try {
      const res = await dashboardApi.updateSettings({
        instance_id: instance.id,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_color: backgroundColor,
        greeting_text: greetingText,
        example_questions: exampleQuestions.filter(Boolean),
        system_prompt: systemPrompt,
        free_messages_limit: freeLimit,
      })
      const updated = res.data.chat_instance
      setLocalInstance(updated)
      setInstance(updated)
      toast.success('Настройки сохранены')
    } catch {
      toast.error('Не удалось сохранить настройки')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarFile = async (file: File) => {
    if (!instance) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { toast.error('Допустимые форматы: JPEG, PNG, WebP'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Файл не должен превышать 5 МБ'); return }
    setUploadingAvatar(true)
    try {
      await dashboardApi.uploadAvatar(instance.id, file)
      const res = await dashboardApi.getInstanceById(instance.id)
      const updated = res.data.chat_instance
      setLocalInstance(updated)
      setInstance(updated)
      toast.success('Аватар обновлён')
    } catch {
      toast.error('Не удалось загрузить аватар')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const addQuestion = () => setExampleQuestions((q) => [...q, ''])
  const removeQuestion = (i: number) => setExampleQuestions((q) => q.filter((_, idx) => idx !== i))
  const updateQuestion = (i: number, val: string) =>
    setExampleQuestions((q) => q.map((v, idx) => (idx === i ? val : v)))

  if (!instance) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const avatarUrl = instance.settings?.avatar_url ?? null
  const instanceName = instance.name ?? 'Чат'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Настройки чата</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Внешний вид, контент и поведение AI</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Форма — 2 колонки */}
        <div className="xl:col-span-2 space-y-5">

          {/* Секция: Внешний вид */}
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 space-y-5">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Внешний вид</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Основной цвет', value: primaryColor, setter: setPrimaryColor, id: 'pc' },
                { label: 'Дополнительный', value: secondaryColor, setter: setSecondaryColor, id: 'sc' },
                { label: 'Фон', value: backgroundColor, setter: setBackgroundColor, id: 'bc' },
              ].map(({ label, value, setter, id }) => (
                <div key={id} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 focus-within:border-indigo-400 transition-all">
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-7 h-7 rounded-lg border border-slate-200 shadow-sm cursor-pointer"
                        style={{ backgroundColor: value }}
                        onClick={() => (document.getElementById(id) as HTMLInputElement)?.click()}
                      />
                      <input id={id} type="color" value={value} onChange={(e) => setter(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    </div>
                    <input type="text" value={value} onChange={(e) => setter(e.target.value)}
                      className="flex-1 text-xs font-mono bg-transparent outline-none text-slate-700 dark:text-slate-200 min-w-0"
                      maxLength={7} />
                  </div>
                </div>
              ))}
            </div>

            {/* Аватар */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Аватар</label>
              <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Аватар" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-100 group-hover:ring-indigo-300 transition-all" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl border border-slate-200 dark:border-slate-600 group-hover:border-indigo-300 transition-all">
                      📷
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <><div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Загрузка...</>
                  ) : 'Загрузить фото'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f) }} />
              </div>
            </div>
          </div>

          {/* Секция: Контент */}
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 space-y-5">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Контент</p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Приветственное сообщение</label>
              <textarea
                value={greetingText}
                onChange={(e) => setGreetingText(e.target.value)}
                placeholder="Привет! Чем могу помочь?"
                rows={3}
                maxLength={1000}
                className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 resize-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Примеры вопросов</label>
              {exampleQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    placeholder={`Вопрос ${i + 1}`}
                    className="flex-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 transition-all"
                  />
                  {exampleQuestions.length > 1 && (
                    <button onClick={() => removeQuestion(i)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {exampleQuestions.length < 5 && (
                <button onClick={addQuestion}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Добавить вопрос
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Бесплатных сообщений до paywall</label>
              <input
                type="number" min={0} max={10000} value={freeLimit}
                onChange={(e) => setFreeLimit(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-32 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 transition-all"
              />
            </div>
          </div>

          {/* Секция: AI */}
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">AI</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                System Prompt{' '}
                <span className="text-slate-400 font-normal">(инструкции для AI)</span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ты — полезный AI-ассистент. Отвечай кратко и по делу."
                rows={5}
                className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 resize-none transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 disabled:opacity-60"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />Сохранение...</>
              ) : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* Превью */}
        <div className="xl:col-span-1">
          <div className="sticky top-24 space-y-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Превью</p>
            <ChatPreview
              primaryColor={primaryColor}
              backgroundColor={backgroundColor}
              avatarUrl={avatarUrl}
              greetingText={greetingText}
              exampleQuestions={exampleQuestions}
              name={instanceName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
