// Панель редактирования настроек инстанса
// Цветовая схема, аватар, текст приветствия

import { useState, useRef } from 'react'
import { dashboardApi } from '../api'
import type { ChatInstance } from '@/features/builder/types'

interface SettingsPanelProps {
  instance: ChatInstance
  onUpdated: (updated: ChatInstance) => void
}

export function SettingsPanel({ instance, onUpdated }: SettingsPanelProps) {
  const settings = instance.settings
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color ?? '#6366F1')
  const [secondaryColor, setSecondaryColor] = useState(settings?.secondary_color ?? '#8B5CF6')
  const [backgroundColor, setBackgroundColor] = useState(settings?.background_color ?? '#F8FAFC')
  const [greetingText, setGreetingText] = useState(settings?.greeting_text ?? '')
  const [freeMessagesLimit, setFreeMessagesLimit] = useState<number>(instance.free_messages_limit ?? 10)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await dashboardApi.updateSettings({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_color: backgroundColor,
        greeting_text: greetingText,
        free_messages_limit: freeMessagesLimit,
      })
      onUpdated(res.data.chat_instance)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('Не удалось сохранить настройки. Попробуйте ещё раз.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarFile = async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { setAvatarError('Допустимые форматы: JPEG, PNG, WebP'); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Файл не должен превышать 5 МБ'); return }
    setAvatarError(null)
    setIsUploadingAvatar(true)
    try {
      await dashboardApi.uploadAvatar(file)
      const res = await dashboardApi.getInstance()
      onUpdated(res.data.chat_instance)
    } catch {
      setAvatarError('Не удалось загрузить аватар. Попробуйте ещё раз.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const colorFields = [
    { label: 'Основной', value: primaryColor, setter: setPrimaryColor },
    { label: 'Дополнительный', value: secondaryColor, setter: setSecondaryColor },
    { label: 'Фон', value: backgroundColor, setter: setBackgroundColor },
  ] as Array<{ label: string; value: string; setter: (v: string) => void }>

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-7 py-5 border-b border-slate-100 dark:border-slate-700/60">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Настройки чата</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Цвета, аватар и приветственное сообщение</p>
      </div>

      <div className="px-7 py-6 space-y-7">
        {/* Цветовая схема */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs">🎨</div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Цветовая схема</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {colorFields.map(({ label, value, setter }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/40 transition-all">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-7 h-7 rounded-lg border border-slate-200 shadow-sm cursor-pointer"
                      style={{ backgroundColor: value }}
                      onClick={() => (document.getElementById(`color-${label}`) as HTMLInputElement)?.click()}
                    />
                    <input
                      id={`color-${label}`}
                      type="color"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="flex-1 text-xs font-mono bg-transparent outline-none text-slate-700 dark:text-slate-200 min-w-0"
                    maxLength={7}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Color preview strip */}
          <div className="h-2 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }} />
        </section>

        {/* Аватар */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs">👤</div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Аватар</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {settings?.avatar_url ? (
                <img
                  src={settings.avatar_url}
                  alt="Аватар"
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-100 group-hover:ring-indigo-300 transition-all"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-2xl group-hover:from-indigo-50 group-hover:to-purple-50 dark:group-hover:from-indigo-900/40 dark:group-hover:to-purple-900/40 transition-all border border-slate-200 dark:border-slate-600">
                  📷
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Изменить</span>
              </div>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Загрузить фото
                  </>
                )}
              </button>
              <p className="text-xs text-slate-400">JPEG, PNG, WebP — до 5 МБ</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f) }}
          />
          {avatarError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <span>⚠️</span> {avatarError}
            </p>
          )}
        </section>

        {/* Текст приветствия */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs">💬</div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Приветственное сообщение</p>
          </div>
          <div className="relative">
            <textarea
              value={greetingText}
              onChange={(e) => setGreetingText(e.target.value)}
              placeholder="Привет! Чем могу помочь?"
              rows={3}
              maxLength={1000}
              className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 resize-none transition-all"
            />
            <span className="absolute bottom-3 right-3 text-xs text-slate-400 dark:text-slate-500">{greetingText.length}/1000</span>
          </div>
        </section>

        {/* Лимит бесплатных сообщений */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs">💬</div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Бесплатный лимит сообщений</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={10000}
              value={freeMessagesLimit}
              onChange={(e) => setFreeMessagesLimit(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-32 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">сообщений до paywall</p>
          </div>
        </section>

        {/* Errors / Success */}
        {saveError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span>⚠️</span> {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <span>✓</span> Настройки сохранены
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
