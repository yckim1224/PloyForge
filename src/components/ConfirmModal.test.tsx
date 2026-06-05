import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ConfirmModal } from './ConfirmModal'

afterEach(cleanup)

describe('ConfirmModal', () => {
  test('renders message and labels', () => {
    render(
      <ConfirmModal
        open
        title="Delete"
        message="Really delete?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText('Really delete?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy()
  })

  test('confirm calls onConfirm', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal
        open
        message="Sure?"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  test('cancel calls onCancel', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal
        open
        message="Sure?"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
