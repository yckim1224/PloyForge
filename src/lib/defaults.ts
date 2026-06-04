import type { Domain } from '../types'
import { niceStep } from './geometry'

/** A sensible empty-editor domain (500 km x 150 km cross-section). */
export function defaultDomain(): Domain {
  return {
    xmin: 0,
    xmax: 500_000,
    zmin: -150_000,
    zmax: 0,
    gridSpacing: 25_000,
    meshingOption: 90,
    resolution: 12_500,
  }
}

/** Infer a domain from point bounds (used when importing a .poly without extent metadata). */
export function inferDomain(points: { x: number; z: number }[]): Domain {
  if (points.length === 0) return defaultDomain()
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  const xmin = Math.min(...xs)
  const xmax = Math.max(...xs)
  const zmin = Math.min(...zs)
  const zmax = Math.max(...zs)
  const extent = Math.max(xmax - xmin, zmax - zmin) || 1
  return {
    xmin,
    xmax,
    zmin,
    zmax,
    gridSpacing: niceStep(extent / 20),
    meshingOption: 90,
    resolution: niceStep(extent / 40),
  }
}
