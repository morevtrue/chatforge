// Шаг 1 визарда — выбор цветовой схемы
// Только локальное состояние, без API-вызовов

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { useBuilderStore } from '../store'
import type { BuilderColors } from '../types'

interface Step1ColorsProps {
  onNext: () => void
}

const COLOR_PRESETS: Array<{ name: string; emoji: string; colors: BuilderColors }> = [
  { name: 'Индиго', emoji: '💜', colors: { primaryColor: '#6366F1', secondaryColor: '#8B5CF6', backgroundColor: '#F8FAFC' } },
  { name: 'Изумруд', emoji: '💚', colors: { primaryColor: '#10B981', secondaryColor: '#059669', backgroundColor: '#F0FDF4' } },
  { name: 'Роза', emoji: '🌸', colors: { primaryColor: '#F43F5E', secondaryColor: '#E11D48', backgroundColor: '#FFF1F2' } },
  { name: 'Янтарь', emoji: '🟡', colors: { primaryColor: '#F59E0B', secondaryColor: '#D97706', backgroundColor: '#FFFBEB' } },
  { name: 'Небо', emoji: '🩵', colors: { primaryColor: '#0EA5E9', secondaryColor: '#0284C7', backgroundColor: '#F0F9FF' } },
  { name: 'Тёмная', emoji: '🌙', colors: { primaryColor: '#818CF8', secondaryColor: '#6366F1', backgroundColor: '#1E1B4B' } },
]

export function Step1Colors({ onNext }: Step1ColorsProps) {
  const { colors, setColors, setStep } = useBuilderStore()
  const [localColors, setLocalColors] = useState<BuilderColors>(colors)

  const handlePreset = (preset: BuilderColors) => {
    setLocalColors(preset)
    setColors(preset)
  }

  const handleColorChange = (field: keyof BuilderColors, value: string) => {
    const updated = { ...localColors, [field]: value }
    setLocalColors(updated)
    setColors(updated)
  }

  const handleNext = () => {
    setColors(localColors)
    setStep(2)
    onNext()
  }

  const isSelected = (preset: BuilderColors) =>
    localColors.primaryColor === preset.primaryColor &&
    localColors.backgroundColor === preset.backgroundColor

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Цветовая схема</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Выберите готовую тему или настройте цвета вручную</p>
      </div>

      {/* Presets grid */}
      <div className="grid grid-cols-3 gap-3">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset.colors)}
            className={`group relative p-3 rounded-xl border-2 transition-all duration-200 text-left ${
              isSelected(preset.colors)
                ? 'border-indigo-500 shadow-md shadow-indigo-100 dark:shadow-indigo-900/40'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            {isSelected(preset.colors) && (
              <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            <div
              className="h-10 rounded-lg mb-2 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: preset.colors.backgroundColor }}
            >
              <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: preset.colors.primaryColor }} />
              <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: preset.colors.secondaryColor }} />
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{preset.emoji} {preset.name}</span>
          </button>
        ))}
      </div>

      {/* Manual color pickers */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Настроить вручную</p>
        <div className="grid grid-cols-3 gap-4">
          {([
            { field: 'primaryColor' as keyof BuilderColors, label: 'Основной' },
            { field: 'secondaryColor' as keyof BuilderColors, label: 'Акцент' },
            { field: 'backgroundColor' as keyof BuilderColors, label: 'Фон' },
          ]).map(({ field, label }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</label>
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:border-slate-300 transition-colors">
                <input
                  type="color"
                  value={localColors[field]}
                  onChange={(e) => handleColorChange(field, e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={localColors[field]}
                  onChange={(e) => handleColorChange(field, e.target.value)}
                  className="flex-1 text-xs font-mono bg-transparent outline-none text-slate-700 dark:text-slate-200 min-w-0"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleNext}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white border-0 px-6"
        >
          Далее →
        </Button>
      </div>
    </div>
  )
}
