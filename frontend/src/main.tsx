import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/index.css'
import { Providers } from '@/app/providers'
import { App } from '@/app/App'
// useThemeStore применяет тему при импорте (синхронно из localStorage)
import '@/shared/lib/useThemeStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
