import type { Viewport } from './viewport'
import { screenToWorld, worldToScreen } from './viewport'

export interface GridLine {
  /** [x0, y0, x1, y1] in screen pixels. */
  points: [number, number, number, number]
  /** True for the x=0 / z=0 axis lines (drawn most emphasized). */
  axis: boolean
  /** True every `majorEvery` lines (drawn emphasized between axis and minor). */
  major: boolean
}

export interface GridLabel {
  /** 'x' labels sit along the bottom edge; 'z' labels along the left edge. */
  kind: 'x' | 'z'
  /** World coordinate the label represents (meters). */
  value: number
  /** Screen pixel position along the relevant axis (sx for 'x', sy for 'z'). */
  screenPos: number
  /** Pre-formatted text like "10 km" or "-500 m". */
  text: string
}

const DEFAULT_MAJOR_EVERY = 10

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
  majorEvery = DEFAULT_MAJOR_EVERY,
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
    const idx = Math.round(x / spacing)
    lines.push({
      points: [a.sx, a.sy, b.sx, b.sy],
      axis: Math.abs(x) < eps,
      major: idx % majorEvery === 0,
    })
  }
  for (let z = Math.ceil(zMin / spacing) * spacing; z <= zMax; z += spacing) {
    const a = worldToScreen(v, xMin, z)
    const b = worldToScreen(v, xMax, z)
    const idx = Math.round(z / spacing)
    lines.push({
      points: [a.sx, a.sy, b.sx, b.sy],
      axis: Math.abs(z) < eps,
      major: idx % majorEvery === 0,
    })
  }
  return lines
}

/**
 * Compute the values to render along the bottom (x) and left (z) edges,
 * one per major grid line that intersects the view.
 */
export function computeGridLabels(
  v: Viewport,
  width: number,
  height: number,
  spacing: number,
  maxLines = 500,
  majorEvery = DEFAULT_MAJOR_EVERY,
): GridLabel[] {
  if (spacing <= 0 || width <= 0 || height <= 0 || majorEvery <= 0) return []
  const tl = screenToWorld(v, 0, 0)
  const br = screenToWorld(v, width, height)
  const xMin = Math.min(tl.x, br.x)
  const xMax = Math.max(tl.x, br.x)
  const zMin = Math.min(tl.z, br.z)
  const zMax = Math.max(tl.z, br.z)

  // Mirror the line-cap guard so labels disappear together with the grid.
  const nx = (xMax - xMin) / spacing
  const nz = (zMax - zMin) / spacing
  if (nx + nz > maxLines) return []

  const labels: GridLabel[] = []
  const majorStep = spacing * majorEvery

  const firstX = Math.ceil(xMin / majorStep) * majorStep
  for (let x = firstX; x <= xMax; x += majorStep) {
    const p = worldToScreen(v, x, 0)
    labels.push({ kind: 'x', value: x, screenPos: p.sx, text: formatAxisValue(x) })
  }
  const firstZ = Math.ceil(zMin / majorStep) * majorStep
  for (let z = firstZ; z <= zMax; z += majorStep) {
    const p = worldToScreen(v, 0, z)
    labels.push({ kind: 'z', value: z, screenPos: p.sy, text: formatAxisValue(z) })
  }
  return labels
}

/**
 * Format a coordinate value with an auto-selected unit:
 * - |v| < 1 m → "0"
 * - |v| < 1000 m → integer meters, e.g. "500 m"
 * - otherwise km with up to 2 fractional digits trimmed, e.g. "10 km", "12.5 km"
 */
export function formatAxisValue(v: number): string {
  if (Math.abs(v) < 0.5) return '0'
  const abs = Math.abs(v)
  if (abs < 1000) {
    return `${Math.round(v)} m`
  }
  const km = v / 1000
  const rounded = Math.round(km * 100) / 100
  // Trim trailing zeros: 10.00 → "10", 12.50 → "12.5".
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, '')
  return `${text} km`
}
