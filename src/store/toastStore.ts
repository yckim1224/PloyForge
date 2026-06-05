import { create } from 'zustand'

export type ToastLevel = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  level: ToastLevel
  message: string
}

/** Auto-dismiss delay per toast, in ms. Kept short to stay out of the way. */
export const TOAST_TIMEOUT_MS = 3500

interface ToastState {
  toasts: Toast[]
  push: (message: string, level?: ToastLevel) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, level = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, level, message }] }))
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, TOAST_TIMEOUT_MS)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Stable helper for non-React callers (event handlers, store actions). */
export const toast = {
  info: (msg: string) => useToastStore.getState().push(msg, 'info'),
  success: (msg: string) => useToastStore.getState().push(msg, 'success'),
  warning: (msg: string) => useToastStore.getState().push(msg, 'warning'),
  error: (msg: string) => useToastStore.getState().push(msg, 'error'),
}
