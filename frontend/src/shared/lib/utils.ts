import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Утилита для объединения Tailwind-классов (используется shadcn/ui)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
