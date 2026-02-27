import { useThemeStore } from '@/shared/lib/useThemeStore'

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
      className="relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      style={{ background: isDark ? '#6366f1' : '#e2e8f0' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 flex items-center justify-center text-[9px]"
        style={{ transform: isDark ? 'translateX(20px)' : 'translateX(0)' }}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  )
}
