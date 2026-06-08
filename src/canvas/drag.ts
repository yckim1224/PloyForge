import type { Selection } from '../store/editorStore'
import { snap } from '../lib/geometry'

/** Konva node `name` -> the matching key in {@link Selection}. */
const SELECTION_KEY = {
  point: 'pointIds',
  line: 'lineIds',
  face: 'faceIds',
} as const

/**
 * True only when the pressed node is an already-selected point/line/face (R2:
 * just-selected items are the only ones grabbable for a move). Anything else
 * (empty name, unselected id) returns false so the caller falls back to marquee.
 */
export function isDraggableTarget(name: string, id: string, selection: Selection): boolean {
  if (name !== 'point' && name !== 'line' && name !== 'face') return false
  return selection[SELECTION_KEY[name]].includes(id)
}

/** True once the pointer has moved far enough to count as a drag, not a click (R1). */
export function exceededDragThreshold(dxPx: number, dyPx: number, thresholdPx = 3): boolean {
  return Math.abs(dxPx) > thresholdPx || Math.abs(dyPx) > thresholdPx
}

/**
 * Snap a world-space drag delta to grid-spacing multiples so a drag reads like a
 * continuous keyboard nudge (R4). `free` (Alt held) passes the raw delta through.
 */
export function snapDelta(
  dx: number,
  dz: number,
  spacing: number,
  free: boolean,
): { dx: number; dz: number } {
  if (free || spacing <= 0) return { dx, dz }
  return { dx: snap(dx, spacing, 0), dz: snap(dz, spacing, 0) }
}
