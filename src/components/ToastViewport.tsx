import { createPortal } from 'react-dom'
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import { useToastStore, type Toast, type ToastLevel } from '../store/toastStore'

const LEVEL_CLASS: Record<ToastLevel, string> = {
  info: 'bg-neutral-900 text-white dark:bg-neutral-800',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-neutral-900',
  error: 'bg-red-600 text-white',
}

function LevelIcon({ level }: { level: ToastLevel }) {
  const cls = 'size-4 shrink-0'
  switch (level) {
    case 'success':
      return <CircleCheck className={cls} />
    case 'warning':
      return <TriangleAlert className={cls} />
    case 'error':
      return <CircleX className={cls} />
    default:
      return <Info className={cls} />
  }
}

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-md px-3 py-2 text-xs shadow-lg ${LEVEL_CLASS[t.level]}`}
    >
      <LevelIcon level={t.level} />
      <span className="flex-1 leading-relaxed">{t.message}</span>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/**
 * App-level toast viewport. Renders the current toast stack at the bottom
 * right via a portal so canvas hit-testing is unaffected; each toast carries
 * its own auto-dismiss timer set in the store.
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed bottom-3 right-3 z-[80] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>,
    document.body,
  )
}
