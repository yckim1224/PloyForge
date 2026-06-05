import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TOAST_TIMEOUT_MS, toast, useToastStore } from './toastStore'

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toastStore', () => {
  test('push appends a toast with the given level and a unique id', () => {
    const id1 = toast.info('hello')
    const id2 = toast.warning('careful')
    expect(id1).not.toBe(id2)
    const list = useToastStore.getState().toasts
    expect(list.length).toBe(2)
    expect(list[0].level).toBe('info')
    expect(list[1].level).toBe('warning')
    expect(list[0].message).toBe('hello')
  })

  test('dismiss removes a single toast by id', () => {
    const id = toast.info('first')
    toast.info('second')
    useToastStore.getState().dismiss(id)
    const list = useToastStore.getState().toasts
    expect(list.length).toBe(1)
    expect(list[0].message).toBe('second')
  })

  test('auto-dismisses after TOAST_TIMEOUT_MS', () => {
    toast.error('boom')
    expect(useToastStore.getState().toasts.length).toBe(1)
    vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1)
    expect(useToastStore.getState().toasts.length).toBe(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts.length).toBe(0)
  })

  test('toast helpers map to the correct level', () => {
    toast.info('i')
    toast.success('s')
    toast.warning('w')
    toast.error('e')
    const levels = useToastStore.getState().toasts.map((t) => t.level)
    expect(levels).toEqual(['info', 'success', 'warning', 'error'])
  })
})
