import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'

// Глобальный QueryClient — кеш серверного состояния
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 минута
      retry: 1,
    },
  },
})

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
        {/* Глобальные toast-уведомления */}
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
