import { describe, expect, test } from 'vitest'
import {
  nodeRectToWorld,
  resolveResize,
  snapEdge,
  snapResizeNonUniform,
  snapResizeToGrid,
  type BgRect,
} from './imageTransform'
import { worldToScreen, type Viewport } from './viewport'

const vp: Viewport = { scale: 0.5, originX: 100, originY: 200 }

describe('nodeRectToWorld', () => {
  test('recovers the world top-left from a plain move (scale factors 1)', () => {
    const s = worldToScreen(vp, 1000, -500)
    const out = nodeRectToWorld({ x: s.sx, y: s.sy, scaleX: 1, scaleY: 1 }, vp, 4, 4)
    expect(out.x).toBeCloseTo(1000)
    expect(out.z).toBeCloseTo(-500)
    expect(out.scaleX).toBe(4)
    expect(out.scaleZ).toBe(4)
  })

  test('folds per-axis resize factors into scaleX / scaleZ', () => {
    const out = nodeRectToWorld({ x: vp.originX, y: vp.originY, scaleX: 2, scaleY: 3 }, vp, 3, 3)
    expect(out.x).toBeCloseTo(0)
    expect(out.z).toBeCloseTo(0)
    expect(out.scaleX).toBeCloseTo(6)
    expect(out.scaleZ).toBeCloseTo(9)
  })
})

describe('snapEdge', () => {
  test('snaps the moved edge and reports the span/scale', () => {
    const a = snapEdge(107, 0, 100, 10) // right edge 107 -> 110, fixed left 0
    expect(a.lo).toBe(0)
    expect(a.hi).toBe(110)
    expect(a.scale).toBeCloseTo(1.1)

    const b = snapEdge(7, 100, 100, 10) // left edge 7 -> 10, fixed right 100
    expect(b.lo).toBe(10)
    expect(b.hi).toBe(100)
    expect(b.scale).toBeCloseTo(0.9)
  })
})

describe('snapResizeToGrid (uniform / locked path)', () => {
  const prev: BgRect = { x: 0, z: 0, scaleX: 1, scaleZ: 1, naturalWidth: 100, naturalHeight: 50 }

  test('dragging bottom-right snaps width, keeps the top-left fixed', () => {
    const raw: BgRect = { x: 0, z: 0, scaleX: 1.07, scaleZ: 1.07, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeToGrid(prev, raw, 'bottom-right', 10)!
    expect(out.x).toBe(0)
    expect(out.z).toBe(0)
    expect(out.scale).toBeCloseTo(1.1) // BR.x 107 -> 110 (3 away) vs z -53.5 -> -50 (3.5 away)
  })

  test('snaps whichever axis is nearest a grid line (keep-ratio)', () => {
    // BR corner (106, -53): x is 4 from its grid line (110), z is 3 from -50 -> snap z.
    const raw: BgRect = { x: 0, z: 0, scaleX: 1.06, scaleZ: 1.06, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeToGrid(prev, raw, 'bottom-right', 10)!
    expect(out.scale).toBeCloseTo(1.0) // z -53 -> -50, scale 50/50
  })

  test('dragging top-left snaps while keeping the bottom-right corner fixed', () => {
    const raw: BgRect = { x: 7, z: -3.5, scaleX: 0.93, scaleZ: 0.93, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeToGrid(prev, raw, 'top-left', 10)!
    expect(out.scale).toBeCloseTo(0.9)
    expect(out.x).toBeCloseTo(10)
    expect(out.z).toBeCloseTo(-5)
    expect(out.x + raw.naturalWidth * out.scale).toBeCloseTo(100)
    expect(out.z - raw.naturalHeight * out.scale).toBeCloseTo(-50)
  })

  test('returns null when the snap collapses the box', () => {
    const raw: BgRect = { x: 0, z: 0, scaleX: 0.02, scaleZ: 0.02, naturalWidth: 100, naturalHeight: 50 }
    expect(snapResizeToGrid(prev, raw, 'bottom-right', 10)).toBeNull()
  })
})

describe('snapResizeNonUniform', () => {
  const prev: BgRect = { x: 0, z: 0, scaleX: 1, scaleZ: 1, naturalWidth: 100, naturalHeight: 50 }

  test('pure-X stretch snaps X and leaves Z untouched', () => {
    const raw: BgRect = { x: 0, z: 0, scaleX: 1.07, scaleZ: 1, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeNonUniform(prev, raw, 10)
    expect(out.scaleX).toBeCloseTo(1.1) // right 107 -> 110
    expect(out.x).toBe(0)
    expect(out.scaleZ).toBe(1) // unchanged
    expect(out.z).toBe(0) // unchanged
  })

  test('pure-Z stretch snaps Z and leaves X untouched', () => {
    const raw: BgRect = { x: 0, z: 0, scaleX: 1, scaleZ: 1.37, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeNonUniform(prev, raw, 10)
    expect(out.scaleX).toBe(1) // unchanged
    expect(out.x).toBe(0) // unchanged
    expect(out.scaleZ).toBeCloseTo(1.4) // bottom -68.5 -> -70, height 70, scale 1.4
    expect(out.z).toBe(0)
  })

  test('corner stretches both axes independently', () => {
    const raw: BgRect = { x: 0, z: 0, scaleX: 1.07, scaleZ: 1.37, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeNonUniform(prev, raw, 10)
    expect(out.scaleX).toBeCloseTo(1.1)
    expect(out.scaleZ).toBeCloseTo(1.4)
  })

  test('keeps an axis when its snap would collapse the box', () => {
    const raw: BgRect = { x: 0, z: 0, scaleX: 0.02, scaleZ: 1, naturalWidth: 100, naturalHeight: 50 }
    const out = snapResizeNonUniform(prev, raw, 10)
    expect(out.scaleX).toBe(1) // right ~2 snaps to 0 -> degenerate -> keep prev
    expect(out.scaleZ).toBe(1)
  })
})

describe('resolveResize', () => {
  const prev: BgRect = { x: 0, z: 0, scaleX: 1, scaleZ: 1, naturalWidth: 100, naturalHeight: 50 }
  const raw: BgRect = { x: 0, z: 0, scaleX: 1.07, scaleZ: 1.07, naturalWidth: 100, naturalHeight: 50 }

  test('locked + corner snaps uniformly', () => {
    const out = resolveResize(prev, raw, 'bottom-right', 10, false, true)
    expect(out.scaleX).toBeCloseTo(1.1)
    expect(out.scaleZ).toBeCloseTo(1.1)
  })

  test('Alt (free) returns the raw rect', () => {
    expect(resolveResize(prev, raw, 'bottom-right', 10, true, true)).toEqual({
      x: 0,
      z: 0,
      scaleX: 1.07,
      scaleZ: 1.07,
    })
  })

  test('locked with an unknown anchor returns the raw rect', () => {
    expect(resolveResize(prev, raw, null, 10, false, true)).toEqual({
      x: 0,
      z: 0,
      scaleX: 1.07,
      scaleZ: 1.07,
    })
  })

  test('unlocked dispatches to per-axis snap', () => {
    const out = resolveResize(prev, raw, null, 10, false, false)
    expect(out.scaleX).toBeCloseTo(1.1) // right 107 -> 110
    expect(out.scaleZ).toBeCloseTo(1.0) // bottom -53.5 -> -50
  })
})
