import { describe, expect, test } from 'vitest'
import { fitPoints, screenToWorld, worldToScreen, zoomAt } from './viewport'
import { computeGridLines } from './grid'
import type { Point } from '../types'

const SAMPLE_POINTS: Point[] = [
  { id: 'a', x: 0, z: 0 },
  { id: 'b', x: 500_000, z: 0 },
  { id: 'c', x: 500_000, z: -150_000 },
  { id: 'd', x: 0, z: -150_000 },
]

describe('viewport transforms', () => {
  const vp = { scale: 0.001, originX: 100, originY: 50 }

  test('worldToScreen and screenToWorld are inverses', () => {
    const w = { x: 250_000, z: -80_000 }
    const s = worldToScreen(vp, w.x, w.z)
    const back = screenToWorld(vp, s.sx, s.sy)
    expect(back.x).toBeCloseTo(w.x, 3)
    expect(back.z).toBeCloseTo(w.z, 3)
  })

  test('z=0 maps to originY and deeper z renders lower (larger screen y)', () => {
    const surface = worldToScreen(vp, 0, 0)
    const deep = worldToScreen(vp, 0, -100_000)
    expect(surface.sy).toBeCloseTo(50)
    expect(deep.sy).toBeGreaterThan(surface.sy)
  })

  test('zoomAt keeps the world point under the cursor fixed', () => {
    const sx = 300
    const sy = 200
    const before = screenToWorld(vp, sx, sy)
    const zoomed = zoomAt(vp, 2, sx, sy)
    const after = screenToWorld(zoomed, sx, sy)
    expect(after.x).toBeCloseTo(before.x, 2)
    expect(after.z).toBeCloseTo(before.z, 2)
    expect(zoomed.scale).toBeCloseTo(vp.scale * 2, 12)
  })

  test('fitPoints centers the bbox of the supplied points within the viewport', () => {
    const v = fitPoints(SAMPLE_POINTS, 800, 600)
    const xmin = 0
    const xmax = 500_000
    const zmin = -150_000
    const zmax = 0
    const center = worldToScreen(v, (xmin + xmax) / 2, (zmin + zmax) / 2)
    expect(center.sx).toBeCloseTo(400, 0)
    expect(center.sy).toBeCloseTo(300, 0)
    // Bbox fits inside the padded area.
    const tl = worldToScreen(v, xmin, zmax)
    expect(tl.sx).toBeGreaterThanOrEqual(0)
    expect(tl.sy).toBeGreaterThanOrEqual(0)
  })

  test('fitPoints falls back to a sensible centered extent for an empty document', () => {
    const v = fitPoints([], 800, 600)
    const center = worldToScreen(v, 0, 0)
    expect(center.sx).toBeCloseTo(400, 0)
    expect(center.sy).toBeCloseTo(300, 0)
    expect(v.scale).toBeGreaterThan(0)
  })
})

describe('computeGridLines', () => {
  test('produces lines spanning the view and flags axis lines', () => {
    const v = fitPoints(SAMPLE_POINTS, 800, 600)
    const lines = computeGridLines(v, 800, 600, 25_000)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.some((l) => l.axis)).toBe(true)
  })

  test('returns nothing when too zoomed out (line cap)', () => {
    const v = { scale: 1e-7, originX: 0, originY: 0 }
    const lines = computeGridLines(v, 800, 600, 1, 500)
    expect(lines.length).toBe(0)
  })
})
