import type { Domain, Point } from '../types'

/** Single-bit boundary flags used by DES3D in 2D. */
export const BDRY = {
  NONE: 0,
  X0: 1, // left
  X1: 2, // right
  Z0: 16, // bottom
  Z1: 32, // top
} as const

export interface BoundaryOption {
  value: number
  label: string
  short: string
}

export const BOUNDARY_OPTIONS_2D: BoundaryOption[] = [
  { value: 0, label: 'Internal', short: '—' },
  { value: 1, label: 'Left (X0)', short: 'X0' },
  { value: 2, label: 'Right (X1)', short: 'X1' },
  { value: 16, label: 'Bottom (Z0)', short: 'Z0' },
  { value: 32, label: 'Top (Z1)', short: 'Z1' },
]

/** DES3D rejects flags with multiple bits set. 0 and any power of two are valid. */
export function isSingleBitFlag(flag: number): boolean {
  if (!Number.isInteger(flag) || flag < 0) return false
  return flag === 0 || (flag & (flag - 1)) === 0
}

const FLAG_COLORS: Record<number, string> = {
  0: '#94a3b8', // slate — internal
  1: '#3b82f6', // blue — left
  2: '#ef4444', // red — right
  16: '#f59e0b', // amber — bottom
  32: '#10b981', // green — top
}

export function boundaryColor(flag: number): string {
  return FLAG_COLORS[flag] ?? '#a855f7'
}

/** Internal segments render dashed; boundary segments solid. */
export function boundaryDash(flag: number): number[] | undefined {
  return flag === 0 ? [8, 6] : undefined
}

/**
 * Auto-assign a boundary flag from a segment's position relative to the domain extent.
 * A segment lying on a domain edge gets that edge's flag; otherwise 0 (internal).
 */
export function autoBoundaryFlag(p0: Point, p1: Point, domain: Domain, eps?: number): number {
  const span = Math.max(domain.xmax - domain.xmin, domain.zmax - domain.zmin)
  const ex = eps ?? (span > 0 ? span * 1e-6 : 1e-6)
  const near = (a: number, b: number) => Math.abs(a - b) <= ex
  if (near(p0.x, domain.xmin) && near(p1.x, domain.xmin)) return BDRY.X0
  if (near(p0.x, domain.xmax) && near(p1.x, domain.xmax)) return BDRY.X1
  if (near(p0.z, domain.zmin) && near(p1.z, domain.zmin)) return BDRY.Z0
  if (near(p0.z, domain.zmax) && near(p1.z, domain.zmax)) return BDRY.Z1
  return BDRY.NONE
}
