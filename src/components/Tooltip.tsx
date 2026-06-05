import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps {
  /** Tooltip body. Strings containing `\n` are rendered as separate lines. */
  content: ReactNode
  /** Trigger element. Wrapped in a span that owns the hover/focus handlers. */
  children: ReactElement
  /** Where the tooltip floats relative to the trigger. Default `bottom`. */
  placement?: 'bottom' | 'left'
  /** Milliseconds to wait before showing on hover/focus. Default 250. */
  delay?: number
}

interface Position {
  top: number
  left: number
}

function renderContent(content: ReactNode): ReactNode {
  if (typeof content !== 'string' || !content.includes('\n')) return content
  return content.split('\n').map((row, i) => <div key={i}>{row}</div>)
}

/**
 * Hover/focus tooltip rendered via portal. Supports multi-line string content
 * (newlines become separate lines), keyboard accessibility (focus/blur/Esc),
 * and basic placement. Sets `aria-describedby` on the wrapper while visible.
 */
export function Tooltip({ content, children, placement = 'bottom', delay = 250 }: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Position>({ top: 0, left: 0 })
  const id = useId()

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  const show = useCallback(() => {
    clearTimer()
    timerRef.current = window.setTimeout(() => setOpen(true), delay)
  }, [clearTimer, delay])

  const hide = useCallback(() => {
    clearTimer()
    setOpen(false)
  }, [clearTimer])

  // Recompute position when opening or when the window resizes/scrolls.
  useEffect(() => {
    if (!open) return
    const place = () => {
      const trig = wrapperRef.current
      const tip = tooltipRef.current
      if (!trig || !tip) return
      const tr = trig.getBoundingClientRect()
      const tw = tip.offsetWidth
      const th = tip.offsetHeight
      const gap = 8
      if (placement === 'left') {
        setPos({ top: tr.top + tr.height / 2 - th / 2, left: tr.left - tw - gap })
      } else {
        setPos({ top: tr.bottom + gap, left: tr.left + tr.width / 2 - tw / 2 })
      }
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, placement])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Escape' && open) hide()
  }

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={onKeyDown}
        aria-describedby={open ? id : undefined}
        className="inline-flex"
      >
        {children}
      </span>
      {open
        ? createPortal(
            <div
              ref={tooltipRef}
              id={id}
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
              className="pointer-events-none fixed z-[60] max-w-xs whitespace-pre-line rounded-md border border-neutral-200 bg-neutral-900 px-2.5 py-1.5 text-xs leading-relaxed text-white shadow-md dark:border-neutral-700 dark:bg-neutral-800"
            >
              {renderContent(content)}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
