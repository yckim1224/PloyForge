import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastViewport } from './ToastViewport'
import { toast, useToastStore } from '../store/toastStore'

beforeEach(() => useToastStore.setState({ toasts: [] }))
afterEach(() => {
  cleanup()
  useToastStore.setState({ toasts: [] })
})

describe('ToastViewport', () => {
  test('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastViewport />)
    expect(container.querySelectorAll('[role="status"]').length).toBe(0)
  })

  test('renders an aria-live toast for each entry', () => {
    toast.warning('A line between these points already exists.')
    render(<ToastViewport />)
    expect(screen.getByText('A line between these points already exists.')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  test('clicking dismiss removes the toast immediately', () => {
    toast.info('hello')
    render(<ToastViewport />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(useToastStore.getState().toasts.length).toBe(0)
  })
})
