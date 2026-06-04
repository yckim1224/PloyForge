import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface ResizableSplitProps {
  left: ReactNode
  right: ReactNode
  /** Initial fraction (0..1) of the total width given to the left pane. */
  initialFraction?: number
  /** Clamp bounds for the left fraction. */
  minFraction?: number
  maxFraction?: number
}

/**
 * A two-pane horizontal split with a draggable divider.
 * Kept dependency-free: the divider updates a width fraction in state.
 */
export function ResizableSplit({
  left,
  right,
  initialFraction = 0.5,
  minFraction = 0.2,
  maxFraction = 0.8,
}: ResizableSplitProps) {
  const [fraction, setFraction] = useState(initialFraction)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const startDrag = useCallback(() => {
    draggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const next = (e.clientX - rect.left) / rect.width
      setFraction(Math.min(maxFraction, Math.max(minFraction, next)))
    }
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [minFraction, maxFraction])

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div className="h-full min-w-0" style={{ width: `${fraction * 100}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        className="w-1 shrink-0 cursor-col-resize bg-neutral-200 transition-colors hover:bg-violet-400"
      />
      <div className="h-full min-w-0 flex-1">{right}</div>
    </div>
  )
}
