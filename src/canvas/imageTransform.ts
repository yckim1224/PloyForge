import { screenToWorld, type Viewport } from './viewport'

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
