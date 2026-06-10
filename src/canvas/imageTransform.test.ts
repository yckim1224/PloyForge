import { describe, expect, test } from 'vitest'
import { nodeRectToWorld } from './imageTransform'
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
