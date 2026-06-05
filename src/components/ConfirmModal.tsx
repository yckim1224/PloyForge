import { useRef } from 'react'
import { Modal } from './Modal'

export interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  /** When true, the confirm button uses a destructive (red) style. */
  destructive?: boolean
}

/** Yes/No confirmation built on top of {@link Modal}. */
export function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmClass = destructive
    ? 'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400'
    : 'rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400'
  return (
    <Modal open={open} onClose={onCancel} title={title} initialFocusRef={cancelRef}>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} className={confirmClass}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
