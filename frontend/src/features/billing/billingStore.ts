// Zustand-стор для системы подписок и монетизации
// Хранит состояние планов (Creator), подписки и публичных планов (End User), а также Paywall

import { create } from 'zustand'
import { getPlans, getPlansByInstance, getPublicPlans, getCurrentSubscription } from './api'
import type { SubscriptionPlan, Subscription } from './types'

interface BillingState {
  plans: SubscriptionPlan[]
  plansLoading: boolean
  currentSubscription: Subscription | null
  subscriptionLoading: boolean
  publicPlans: SubscriptionPlan[]
  publicPlansLoading: boolean
  paywallOpen: boolean

  fetchPlans: () => Promise<void>
  fetchPlansByInstance: (instanceId: string) => Promise<void>
  fetchPublicPlans: () => Promise<void>
  fetchCurrentSubscription: () => Promise<void>
  openPaywall: () => void
  closePaywall: () => void
}

export const useBillingStore = create<BillingState>()((set) => ({
  plans: [],
  plansLoading: false,
  currentSubscription: null,
  subscriptionLoading: false,
  publicPlans: [],
  publicPlansLoading: false,
  paywallOpen: false,

  fetchPlans: async () => {
    set({ plansLoading: true })
    try {
      const { plans } = await getPlans()
      set({ plans })
    } finally {
      set({ plansLoading: false })
    }
  },

  fetchPlansByInstance: async (instanceId: string) => {
    set({ plansLoading: true })
    try {
      const { plans } = await getPlansByInstance(instanceId)
      set({ plans })
    } finally {
      set({ plansLoading: false })
    }
  },

  fetchPublicPlans: async () => {
    set({ publicPlansLoading: true })
    try {
      const { plans } = await getPublicPlans()
      set({ publicPlans: plans })
    } finally {
      set({ publicPlansLoading: false })
    }
  },

  fetchCurrentSubscription: async () => {
    set({ subscriptionLoading: true })
    try {
      const { subscription } = await getCurrentSubscription()
      set({ currentSubscription: subscription })
    } finally {
      set({ subscriptionLoading: false })
    }
  },

  openPaywall: () => set({ paywallOpen: true }),
  closePaywall: () => set({ paywallOpen: false }),
}))
