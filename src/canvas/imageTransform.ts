import { screenToWorld, type Viewport } from './viewport'
import { snap } from '../lib/geometry'

/** A Konva image node's post-gesture geometry, read in screen space. */
export interface NodeRect {
  /** Node screen x of the top-left corner, in px. */
  x: number
  /** Node screen y of the top-left corner, in px. */
  y: number
  /** Horizontal scale factor Konva applied during a transform (1 for a plain move). */
  scaleX: number
  /** Vertical scale factor Konva applied during a transform (1 for a plain move). */
  scaleY: number
}

/**
 * Convert a dragged/resized image node back to its world-space top-left and the
 * per-axis meters-per-pixel scales stored on the background. The Transformer
 * reports its resize as node scale factors; folding them into the previous scales
 * lets the derived render reproduce the same on-screen size after the node scale
 * is reset to 1. A plain move passes `scaleX: 1, scaleY: 1`, leaving scale unchanged.
 */
export function nodeRectToWorld(
  rect: NodeRect,
  vp: Viewport,
  prevScaleX: number,
  prevScaleZ: number,
): { x: number; z: number; scaleX: number; scaleZ: number } {
  const tl = screenToWorld(vp, rect.x, rect.y)
  return { x: tl.x, z: tl.z, scaleX: prevScaleX * rect.scaleX, scaleZ: prevScaleZ * rect.scaleY }
}

export type ResizeAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** A background image rect in world space (top-left x/z, per-axis meters-per-pixel). */
export interface BgRect {
  x: number
  z: number
  scaleX: number
  scaleZ: number
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
  const w = rect.naturalWidth * rect.scaleX
  const h = rect.naturalHeight * rect.scaleZ
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
 * on a grid line, holding the opposite corner fixed. Used for the locked path,
 * where scaleX === scaleZ; returns the new top-left and the (uniform) scale, or
 * null when the snap would be degenerate (caller keeps the raw result).
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
  // Snap whichever axis the dragged corner is nearest to a grid line on, so a
  // keep-ratio resize sticks to the closer of the vertical / horizontal grid
  // lines (the ratio then fixes the other axis).
  const snapX = snap(dragRaw.x, spacing)
  const snapZ = snap(dragRaw.z, spacing)
  let scale: number
  if (Math.abs(snapX - dragRaw.x) <= Math.abs(snapZ - dragRaw.z)) {
    scale = Math.abs(snapX - fixed.x) / raw.naturalWidth
  } else {
    scale = Math.abs(snapZ - fixed.z) / raw.naturalHeight
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
 * Snap one axis: pull the moved edge to the grid, hold the fixed edge, and report
 * the resulting `[lo, hi]` span and scale. Axis-agnostic — callers pass already
 * signed world coordinates and pick `lo` (X top-left = left) or `hi` (Z top-left
 * = top, since z grows upward).
 */
export function snapEdge(
  moved: number,
  fixed: number,
  naturalDim: number,
  spacing: number,
): { lo: number; hi: number; scale: number } {
  const snapped = snap(moved, spacing)
  const lo = Math.min(snapped, fixed)
  const hi = Math.max(snapped, fixed)
  return { lo, hi, scale: (hi - lo) / naturalDim }
}

/** Relative threshold deciding whether an axis actually changed during a resize. */
const SCALE_EPS = 1e-6

/**
 * Snap a non-uniform (keep-ratio off) resize per axis: each axis that changed has
 * its moved edge snapped to the grid while the opposite edge stays fixed; an axis
 * that did not change keeps its previous origin and scale (so a single-axis
 * stretch never perturbs the other axis). Works for corner and side drags alike
 * by comparing prev vs raw edges — no anchor needed.
 */
export function snapResizeNonUniform(
  prev: BgRect,
  raw: BgRect,
  spacing: number,
): { x: number; z: number; scaleX: number; scaleZ: number } {
  let x = prev.x
  let scaleX = prev.scaleX
  if (spacing > 0 && Math.abs(raw.scaleX - prev.scaleX) > prev.scaleX * SCALE_EPS) {
    const prevLeft = prev.x
    const prevRight = prev.x + prev.naturalWidth * prev.scaleX
    const rawLeft = raw.x
    const rawRight = raw.x + raw.naturalWidth * raw.scaleX
    const leftMoved = Math.abs(rawLeft - prevLeft) >= Math.abs(rawRight - prevRight)
    const e = leftMoved
      ? snapEdge(rawLeft, prevRight, prev.naturalWidth, spacing)
      : snapEdge(rawRight, prevLeft, prev.naturalWidth, spacing)
    if (e.scale > 0) {
      x = e.lo // X top-left = left edge (min)
      scaleX = e.scale
    }
  }

  let z = prev.z
  let scaleZ = prev.scaleZ
  if (spacing > 0 && Math.abs(raw.scaleZ - prev.scaleZ) > prev.scaleZ * SCALE_EPS) {
    const prevTop = prev.z
    const prevBottom = prev.z - prev.naturalHeight * prev.scaleZ
    const rawTop = raw.z
    const rawBottom = raw.z - raw.naturalHeight * raw.scaleZ
    const topMoved = Math.abs(rawTop - prevTop) >= Math.abs(rawBottom - prevBottom)
    const e = topMoved
      ? snapEdge(rawTop, prevBottom, prev.naturalHeight, spacing)
      : snapEdge(rawBottom, prevTop, prev.naturalHeight, spacing)
    if (e.scale > 0) {
      z = e.hi // Z top-left = top edge (max, since z grows upward)
      scaleZ = e.scale
    }
  }

  return { x, z, scaleX, scaleZ }
}

/**
 * Resolve the final rect after a resize. `free` (Alt) keeps the raw result.
 * When `locked`, snap uniformly via {@link snapResizeToGrid} (anchor-based);
 * otherwise snap per axis via {@link snapResizeNonUniform} (the `anchor` is
 * unused on this path — the moved edge is inferred from prev vs raw).
 */
export function resolveResize(
  prev: BgRect,
  raw: BgRect,
  anchor: string | null,
  spacing: number,
  free: boolean,
  locked: boolean,
): { x: number; z: number; scaleX: number; scaleZ: number } {
  const fallback = { x: raw.x, z: raw.z, scaleX: raw.scaleX, scaleZ: raw.scaleZ }
  if (free) return fallback
  if (locked) {
    const a = asCornerAnchor(anchor)
    if (!a) return fallback
    const s = snapResizeToGrid(prev, raw, a, spacing)
    return s ? { x: s.x, z: s.z, scaleX: s.scale, scaleZ: s.scale } : fallback
  }
  return snapResizeNonUniform(prev, raw, spacing)
}
