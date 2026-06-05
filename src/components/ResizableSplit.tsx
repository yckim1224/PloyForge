import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { clampLeftPx } from './resizableSplitClamp'

interface ResizableSplitProps {
  left: ReactNode
  right: ReactNode
  /** Initial left-pane width in px. */
  initialPx?: number
  /** Clamp bounds for the left-pane width in px. */
  minPx?: number
  maxPx?: number
}

const STORAGE_KEY = 'poly-forge:layout:v1'

function readPersistedLeftPx(min: number, max: number, fallback: number): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'leftPx' in parsed) {
      const v = (parsed as { leftPx: unknown }).leftPx
      if (typeof v === 'number' && Number.isFinite(v)) return clampLeftPx(v, min, max)
    }
  } catch {
    /* storage may be unavailable or malformed; fall back */
  }
  return fallback
}

function persistLeftPx(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leftPx: value }))
  } catch {
    /* storage may be unavailable (private mode, quota); ignore */
  }
}

/**
 * A two-pane horizontal split with a draggable divider.
 * The left pane carries a px-clamped width; the right pane fills the rest.
 */
export function ResizableSplit({
  left,
  right,
  initialPx = 320,
  minPx = 280,
  maxPx = 520,
}: ResizableSplitProps) {
  const [leftPx, setLeftPx] = useState(() => readPersistedLeftPx(minPx, maxPx, initialPx))
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  // Stash leftPx in a ref so the persist-on-mouseup closure can read the
  // latest value without retriggering the window-listener effect on every
  // pixel of drag.
  const leftPxRef = useRef(leftPx)
  useEffect(() => {
    leftPxRef.current = leftPx
  }, [leftPx])

  const startDrag = useCallback(() => {
    draggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setLeftPx(clampLeftPx(e.clientX - rect.left, minPx, maxPx))
    }
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Persist once per gesture rather than on every pixel of movement.
      persistLeftPx(leftPxRef.current)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [minPx, maxPx])

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div className="h-full shrink-0" style={{ width: `${leftPx}px` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={minPx}
        aria-valuemax={maxPx}
        aria-valuenow={leftPx}
        onMouseDown={startDrag}
        className="w-1 shrink-0 cursor-col-resize bg-neutral-200 transition-colors hover:bg-violet-400 dark:bg-neutral-800"
      />
      <div className="h-full min-w-0 flex-1">{right}</div>
    </div>
  )
}
