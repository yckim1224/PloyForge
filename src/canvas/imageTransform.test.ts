import { describe, expect, test } from 'vitest'
import { nodeRectToWorld, resolveResize, snapResizeToGrid, type BgRect } from './imageTransform'
import { worldToScreen, type Viewport } from './viewport'

const vp: Viewport = { scale: 0.5, originX: 100, originY: 200 }

describe('nodeRectToWorld', () => {
  test('recovers the world top-left from a plain move (scaleX = 1)', () => {
    const s = worldToScreen(vp, 1000, -500)
    const out = nodeRectToWorld({ x: s.sx, y: s.sy, scaleX: 1 }, vp, 4)
    expect(out.x).toBeCloseTo(1000)
    expect(out.z).toBeCloseTo(-500)
    expect(out.scale).toBe(4)
  })

  test('folds a uniform resize factor into the scale', () => {
    const out = nodeRectToWorld({ x: vp.originX, y: vp.originY, scaleX: 2 }, vp, 3)
    expect(out.x).toBeCloseTo(0)
    expect(out.z).toBeCloseTo(0)
    expect(out.scale).toBeCloseTo(6)
  })
})

describe('snapResizeToGrid', () => {
  const prev: BgRect = { x: 0, z: 0, scale: 1, naturalWidth: 100, naturalHeight: 50 }

  test('dragging bottom-right snaps width, keeps the top-left fixed', () => {
    const raw: BgRect = { x: 0, z: 0, scale: 1.07, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeToGrid(prev, raw, 'bottom-right', 10)!
    expect(out.x).toBe(0)
    expect(out.z).toBe(0)
    expect(out.scale).toBeCloseTo(1.1) // BR.x 107 -> 110, scale 110/100
  })

  test('dragging top-left snaps while keeping the bottom-right corner fixed', () => {
    // raw: BR fixed at (100,-50), scale 0.93 -> top-left at (7,-3.5).
    const raw: BgRect = { x: 7, z: -3.5, scale: 0.93, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeToGrid(prev, raw, 'top-left', 10)!
    expect(out.scale).toBeCloseTo(0.9) // TL.x 7 -> 10, width 90, scale 0.9
    expect(out.x).toBeCloseTo(10)
    expect(out.z).toBeCloseTo(-5)
    // The fixed (bottom-right) corner is preserved at (100, -50).
    expect(out.x + raw.naturalWidth * out.scale).toBeCloseTo(100)
    expect(out.z - raw.naturalHeight * out.scale).toBeCloseTo(-50)
  })

  test('returns null when the snap collapses the box', () => {
    const raw: BgRect = { x: 0, z: 0, scale: 0.02, naturalWidth: 100, naturalHeight: 50 }
    // BR.x ~2 snaps to 0 -> zero width.
    expect(snapResizeToGrid(prev, raw, 'bottom-right', 10)).toBeNull()
  })
})

describe('resolveResize', () => {
  const prev: BgRect = { x: 0, z: 0, scale: 1, naturalWidth: 100, naturalHeight: 50 }
  const raw: BgRect = { x: 0, z: 0, scale: 1.07, naturalWidth: 100, naturalHeight: 50 }

  test('snaps when not free and the anchor is a corner', () => {
    expect(resolveResize(prev, raw, 'bottom-right', 10, false).scale).toBeCloseTo(1.1)
  })

  test('returns the raw rect when Alt (free) is held', () => {
    expect(resolveResize(prev, raw, 'bottom-right', 10, true)).toEqual({ x: 0, z: 0, scale: 1.07 })
  })

  test('returns the raw rect when the anchor is unknown', () => {
    expect(resolveResize(prev, raw, null, 10, false)).toEqual({ x: 0, z: 0, scale: 1.07 })
  })
})
