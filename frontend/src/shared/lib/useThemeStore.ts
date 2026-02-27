import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeStore {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const STORAGE_KEY = 'chatforge-theme'

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

// Применяем тему синхронно до рендера
const initialTheme = getInitialTheme()
applyTheme(initialTheme)

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  toggleTheme: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
    set({ theme: next })
  },
  setTheme: (t: Theme) => {
    applyTheme(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* ignore */ }
    set({ theme: t })
  },
}))
