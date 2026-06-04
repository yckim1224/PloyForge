import type { Viewport } from './viewport'
import { screenToWorld, worldToScreen } from './viewport'

export interface GridLine {
  /** [x0, y0, x1, y1] in screen pixels. */
  points: [number, number, number, number]
  /** True for the x=0 / z=0 axis lines (drawn emphasized). */
  axis: boolean
}

/**
 * Compute grid lines covering the visible screen area at the given world spacing.
 * Returns an empty array when the view is too zoomed out (more than `maxLines`).
 */
export function computeGridLines(
  v: Viewport,
  width: number,
  height: number,
  spacing: number,
  maxLines = 500,
): GridLine[] {
  if (spacing <= 0 || width <= 0 || height <= 0) return []
  const tl = screenToWorld(v, 0, 0)
  const br = screenToWorld(v, width, height)
  const xMin = Math.min(tl.x, br.x)
  const xMax = Math.max(tl.x, br.x)
  const zMin = Math.min(tl.z, br.z)
  const zMax = Math.max(tl.z, br.z)

  const nx = (xMax - xMin) / spacing
  const nz = (zMax - zMin) / spacing
  if (nx + nz > maxLines) return []

  const lines: GridLine[] = []
  const eps = spacing / 2

  for (let x = Math.ceil(xMin / spacing) * spacing; x <= xMax; x += spacing) {
    const a = worldToScreen(v, x, zMax)
    const b = worldToScreen(v, x, zMin)
    lines.push({ points: [a.sx, a.sy, b.sx, b.sy], axis: Math.abs(x) < eps })
  }
  for (let z = Math.ceil(zMin / spacing) * spacing; z <= zMax; z += spacing) {
    const a = worldToScreen(v, xMin, z)
    const b = worldToScreen(v, xMax, z)
    lines.push({ points: [a.sx, a.sy, b.sx, b.sy], axis: Math.abs(z) < eps })
  }
  return lines
}
