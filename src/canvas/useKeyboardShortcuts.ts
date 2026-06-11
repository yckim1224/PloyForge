import { useEffect, type RefObject, type Dispatch, type SetStateAction } from 'react'
import {
  redoEdit,
  undoEdit,
  useEditorStore,
  type NudgeScale,
} from '../store/editorStore'
import { arrowPanDelta, panBy, zoomAt, type Viewport } from './viewport'

/** Per-keypress view pan step (px) when arrows pan with no selection. */
const ARROW_PAN_PX = 40
const ARROW_PAN_LARGE_PX = 200
const ARROW_PAN_FINE_PX = 8

export interface KeyboardShortcutActions {
  deleteSelection: () => void
  clearSelection: () => void
  setTool: (tool: 'select' | 'point' | 'line' | 'pan') => void
  setPendingLineStart: (id: string | null) => void
  nudgeSelection: (dirX: number, dirZ: number, scale: NudgeScale) => void
  nudgeBackground: (dirX: number, dirZ: number, scale: NudgeScale) => void
  removeBackground: () => void
}

export interface KeyboardShortcutsParams {
  /** Viewport-sized container in px; used to zoom about the center. */
  sizeRef: RefObject<{ w: number; h: number }>
  /** Set while a mouse move-drag is in progress; suppresses every key action. */
  dragStartRef: RefObject<{ x: number; y: number; moved: boolean } | null>
  /** Cleared on Space-up and window blur so a held pan can't stick. */
  panningRef: RefObject<{ x: number; y: number } | null>
  setVp: Dispatch<SetStateAction<Viewport>>
  setSpacePan: Dispatch<SetStateAction<boolean>>
  actions: KeyboardShortcutActions
}

/**
 * Global keyboard shortcuts for the canvas: tool switching, undo/redo, select-all,
 * save, zoom, fit, nudge/pan, and Space-to-pan. Live-reads transient store state
 * (selection, marqueeTarget, background) inside the listener so the handler does
 * not need to be re-attached on every selection change.
 */
export function useKeyboardShortcuts({
  sizeRef,
  dragStartRef,
  panningRef,
  setVp,
  setSpacePan,
  actions,
}: KeyboardShortcutsParams): void {
  const {
    deleteSelection,
    clearSelection,
    setTool,
    setPendingLineStart,
    nudgeSelection,
    nudgeBackground,
    removeBackground,
  } = actions

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      // Ignore keys while a mouse move-drag is in progress so keyboard actions
      // (nudge, delete, undo, Escape) can't mutate the selection mid-gesture.
      if (dragStartRef.current) return
      // Hold Space to temporarily pan from any tool (standard editor convention).
      if (e.code === 'Space') {
        e.preventDefault()
        setSpacePan(true)
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redoEdit()
        else undoEdit()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redoEdit()
        return
      }
      // Select all of the current marquee target kind (selection is single-kind).
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        const st = useEditorStore.getState()
        const kind = st.marqueeTarget
        const ids =
          kind === 'point'
            ? st.points.map((p) => p.id)
            : kind === 'line'
              ? st.lines.map((l) => l.id)
              : st.faces.map((f) => f.id)
        st.selectMany(kind, ids)
        return
      }
      // Save shortcut routes to the Actions panel's Export (see requestExport).
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        useEditorStore.getState().requestExport()
        return
      }
      // Keyboard zoom about the view center; Ctrl/Cmd +/- stays browser zoom.
      if (!e.ctrlKey && !e.metaKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        const { w, h } = sizeRef.current
        setVp((v) => zoomAt(v, 1.1, w / 2, h / 2))
        return
      }
      if (!e.ctrlKey && !e.metaKey && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        const { w, h } = sizeRef.current
        setVp((v) => zoomAt(v, 1 / 1.1, w / 2, h / 2))
        return
      }
      // Arrows nudge the selection, or pan the view when nothing is selected
      // (the arrow moves the camera in that direction). Shift = larger step.
      // Alt = fine (1/10), Shift = large (10x); Alt wins when both are held.
      const arrowMove = (dirX: number, dirZ: number, shift: boolean, alt: boolean) => {
        const st = useEditorStore.getState()
        const scale: NudgeScale = alt ? 'fine' : shift ? 'large' : 'normal'
        // A selected background image moves with the arrows (regardless of tool).
        if (st.backgroundSelected && st.background) {
          nudgeBackground(dirX, dirZ, scale)
          return
        }
        const sel = st.selection
        const hasSelection =
          sel.pointIds.length > 0 || sel.lineIds.length > 0 || sel.faceIds.length > 0
        if (hasSelection) {
          nudgeSelection(dirX, dirZ, scale)
          return
        }
        const stepPx = alt ? ARROW_PAN_FINE_PX : shift ? ARROW_PAN_LARGE_PX : ARROW_PAN_PX
        const { dxPx, dyPx } = arrowPanDelta(dirX, dirZ, stepPx)
        setVp((v) => panBy(v, dxPx, dyPx))
      }
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (useEditorStore.getState().backgroundSelected) removeBackground()
          else deleteSelection()
          break
        case 'Escape':
          setPendingLineStart(null)
          clearSelection()
          break
        case 'v':
        case 'V':
          setTool('select')
          break
        case 'p':
        case 'P':
          setTool('point')
          break
        case 'l':
        case 'L':
          setTool('line')
          break
        case 'h':
        case 'H':
          setTool('pan')
          break
        case 'f':
        case 'F':
          if (e.metaKey || e.ctrlKey) return // leave Cmd/Ctrl+F to the browser
          useEditorStore.getState().requestFit()
          break
        case 'ArrowRight':
          e.preventDefault()
          arrowMove(1, 0, e.shiftKey, e.altKey)
          break
        case 'ArrowLeft':
          e.preventDefault()
          arrowMove(-1, 0, e.shiftKey, e.altKey)
          break
        case 'ArrowUp':
          e.preventDefault()
          arrowMove(0, 1, e.shiftKey, e.altKey)
          break
        case 'ArrowDown':
          e.preventDefault()
          arrowMove(0, -1, e.shiftKey, e.altKey)
          break
        default:
          return
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePan(false)
        panningRef.current = null
      }
    }
    // Reset if focus is lost while Space is held (e.g. alt-tab) so pan can't stick.
    const onBlur = () => {
      setSpacePan(false)
      panningRef.current = null
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [
    sizeRef,
    dragStartRef,
    panningRef,
    setVp,
    setSpacePan,
    deleteSelection,
    clearSelection,
    setTool,
    setPendingLineStart,
    nudgeSelection,
    nudgeBackground,
    removeBackground,
  ])
}
