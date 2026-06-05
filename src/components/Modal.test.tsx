import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

afterEach(cleanup)

describe('Modal', () => {
  test('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hello">
        <p>body</p>
      </Modal>,
    )
    expect(screen.queryByText('body')).toBeNull()
  })

  test('renders role=dialog with aria-modal and aria-labelledby', () => {
    render(
      <Modal open onClose={() => {}} title="Hello">
        <p>body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const title = document.getElementById(labelledBy!)
    expect(title?.textContent).toBe('Hello')
  })

  test('Esc key closes the modal', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Hello">
        <button>inside</button>
      </Modal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  test('backdrop click closes the modal', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Hello">
        <p>body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement as HTMLElement
    fireEvent.mouseDown(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  test('clicks on the dialog itself do not close', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Hello">
        <p>body</p>
      </Modal>,
    )
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  test('X close button triggers onClose', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Hello">
        <p>body</p>
      </Modal>,
    )
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  test('body scroll is locked while open', () => {
    const before = document.body.style.overflow
    const { unmount } = render(
      <Modal open onClose={() => {}} title="Hello">
        <p>body</p>
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe(before)
  })
})
