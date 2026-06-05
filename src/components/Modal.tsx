import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface ModalProps {
  /** Whether the modal is rendered. Closed modals render nothing. */
  open: boolean
  /** Invoked when the user requests close (Esc, backdrop, or the X button). */
  onClose: () => void
  /** Optional title; when set, the header renders with this text and links aria-labelledby. */
  title?: string
  children: ReactNode
  /** Element to focus first when opening. Falls back to the first focusable child. */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Backdrop click closes the modal (default true). */
  closeOnBackdrop?: boolean
  /** Esc closes the modal (default true). */
  closeOnEsc?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  )
}

/**
 * Centered modal portal with focus trap, body scroll lock, and ESC/backdrop
 * close. Designed to be the single source of dialog behavior across the app.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const generatedId = useId()
  const titleId = title ? `${generatedId}-title` : undefined

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Capture the previously-focused element and restore on close.
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null
    // Defer initial focus until after the portal renders.
    queueMicrotask(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
        return
      }
      const candidates = focusableWithin(dialogRef.current)
      if (candidates.length > 0) candidates[0].focus()
      else dialogRef.current?.focus()
    })
    return () => {
      previouslyFocused.current?.focus()
    }
  }, [open, initialFocusRef])

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' && closeOnEsc) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Roll focus around within the dialog.
      const items = focusableWithin(dialogRef.current)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !dialogRef.current?.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [closeOnEsc, onClose],
  )

  const onBackdropMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!closeOnBackdrop) return
      if (e.target === e.currentTarget) onClose()
    },
    [closeOnBackdrop, onClose],
  )

  if (!open) return null

  return createPortal(
    <div
      onMouseDown={onBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          {title ? (
            <h2
              id={titleId}
              className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
