// Zustand-стор состояния визарда создания чата

import { create } from 'zustand'
import type { BuilderColors, Currency } from './types'

interface BuilderState {
  currentStep: 1 | 2 | 3 | 4
  colors: BuilderColors
  name: string
  currency: Currency
  avatarUrl: string | null
  greetingText: string
  exampleQuestions: string[]
  freeMessagesLimit: number | null

  // Методы обновления состояния
  setStep: (step: 1 | 2 | 3 | 4) => void
  setColors: (colors: BuilderColors) => void
  setNameAndCurrency: (name: string, currency: Currency) => void
  setGreeting: (text: string, questions: string[]) => void
  setAvatar: (url: string) => void
  setLimit: (limit: number | null) => void
  reset: () => void
}

const initialState = {
  currentStep: 1 as const,
  colors: {
    primaryColor: '#6366F1',
    secondaryColor: '#8B5CF6',
    backgroundColor: '#F8FAFC',
  },
  name: '',
  currency: 'RUB' as Currency,
  avatarUrl: null,
  greetingText: '',
  exampleQuestions: [],
  freeMessagesLimit: null,
}

export const useBuilderStore = create<BuilderState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  setColors: (colors) => set({ colors }),

  setNameAndCurrency: (name, currency) => set({ name, currency }),

  setGreeting: (text, questions) =>
    set({ greetingText: text, exampleQuestions: questions }),

  setAvatar: (url) => set({ avatarUrl: url }),

  setLimit: (limit) => set({ freeMessagesLimit: limit }),

  reset: () => set(initialState),
}))
