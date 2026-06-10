import { screenToWorld, type Viewport } from './viewport'
import { snap } from '../lib/geometry'

/** A Konva image node's post-gesture geometry, read in screen space. */
export interface NodeRect {
  /** Node screen x of the top-left corner, in px. */
  x: number
  /** Node screen y of the top-left corner, in px. */
  y: number
  /** Uniform scale factor Konva applied during a transform (1 for a plain move). */
  scaleX: number
}

/**
 * Convert a dragged/resized image node back to its world-space top-left and the
 * meters-per-pixel `scale` stored on the background. The Transformer reports its
 * resize as a node scale factor; folding it into `prevScale` lets the derived
 * render reproduce the same on-screen size after the node scale is reset to 1.
 * A plain move passes `scaleX: 1`, leaving the scale unchanged.
 */
export function nodeRectToWorld(
  rect: NodeRect,
  vp: Viewport,
  prevScale: number,
): { x: number; z: number; scale: number } {
  const tl = screenToWorld(vp, rect.x, rect.y)
  return { x: tl.x, z: tl.z, scale: prevScale * rect.scaleX }
}

export type ResizeAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** A background image rect in world space (top-left x/z, meters-per-pixel scale). */
export interface BgRect {
  x: number
  z: number
  scale: number
  naturalWidth: number
  naturalHeight: number
}

const CORNER_ANCHORS: ResizeAnchor[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

const OPPOSITE: Record<ResizeAnchor, ResizeAnchor> = {
  'top-left': 'bottom-right',
  'top-right': 'bottom-left',
  'bottom-left': 'top-right',
  'bottom-right': 'top-left',
}

/** Narrow a Konva anchor name to one of the four corner anchors, or null. */
export function asCornerAnchor(name: string | null | undefined): ResizeAnchor | null {
  return name != null && (CORNER_ANCHORS as string[]).includes(name)
    ? (name as ResizeAnchor)
    : null
}

/** World position of one corner of a rect (z grows upward; the image extends down). */
function corner(rect: BgRect, which: ResizeAnchor): { x: number; z: number } {
  const w = rect.naturalWidth * rect.scale
  const h = rect.naturalHeight * rect.scale
  switch (which) {
    case 'top-left':
      return { x: rect.x, z: rect.z }
    case 'top-right':
      return { x: rect.x + w, z: rect.z }
    case 'bottom-left':
      return { x: rect.x, z: rect.z - h }
    case 'bottom-right':
      return { x: rect.x + w, z: rect.z - h }
  }
}

/**
 * Snap a uniform (keep-ratio) resize so the dragged corner's dominant axis lands
 * on a grid line, holding the opposite corner fixed. `prev` is the pre-gesture
 * rect; `raw` is the rect from the raw transform. Returns the new top-left and
 * scale, or null when the snap would be degenerate (caller keeps the raw result).
 */
export function snapResizeToGrid(
  prev: BgRect,
  raw: BgRect,
  dragged: ResizeAnchor,
  spacing: number,
): { x: number; z: number; scale: number } | null {
  if (!(spacing > 0)) return null
  const fixedWhich = OPPOSITE[dragged]
  const fixed = corner(prev, fixedWhich)
  const dragRaw = corner(raw, dragged)
  const dragPrev = corner(prev, dragged)
  // Snap the axis the dragged corner moved along most; the ratio fixes the other.
  let scale: number
  if (Math.abs(dragRaw.x - dragPrev.x) >= Math.abs(dragRaw.z - dragPrev.z)) {
    scale = Math.abs(snap(dragRaw.x, spacing) - fixed.x) / raw.naturalWidth
  } else {
    scale = Math.abs(snap(dragRaw.z, spacing) - fixed.z) / raw.naturalHeight
  }
  if (!(scale > 0)) return null
  const w = raw.naturalWidth * scale
  const h = raw.naturalHeight * scale
  switch (fixedWhich) {
    case 'top-left':
      return { x: fixed.x, z: fixed.z, scale }
    case 'top-right':
      return { x: fixed.x - w, z: fixed.z, scale }
    case 'bottom-left':
      return { x: fixed.x, z: fixed.z + h, scale }
    case 'bottom-right':
      return { x: fixed.x - w, z: fixed.z + h, scale }
  }
}

/**
 * Resolve the final rect after a resize: grid-snapped per {@link snapResizeToGrid}
 * unless `free` (Alt) is held, the anchor is not a corner, or the snap degenerates.
 */
export function resolveResize(
  prev: BgRect,
  raw: BgRect,
  anchor: string | null,
  spacing: number,
  free: boolean,
): { x: number; z: number; scale: number } {
  const fallback = { x: raw.x, z: raw.z, scale: raw.scale }
  const a = asCornerAnchor(anchor)
  if (free || !a) return fallback
  return snapResizeToGrid(prev, raw, a, spacing) ?? fallback
}
