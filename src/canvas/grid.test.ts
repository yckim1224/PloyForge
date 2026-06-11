import { describe, expect, test } from 'vitest'
import { computeGridLabels, computeGridLines, formatAxisValue } from './grid'
import type { Viewport } from './viewport'

// 1 px per meter, origin at (400, 300): handy for predictable assertions.
const VP: Viewport = { scale: 1, originX: 400, originY: 300 }

describe('computeGridLines major flag', () => {
  test('marks every 10th line as major (including the origin) at spacing 1', () => {
    // Bypass the default 500-line cap so the test can assert on all 1400 lines.
    const lines = computeGridLines(VP, 800, 600, 1, 2000)
    // Vertical line at x=0 is both axis and major.
    const xZero = lines.find((l) => l.axis && l.points[0] === l.points[2] && l.points[0] === 400)
    expect(xZero).toBeDefined()
    expect(xZero?.major).toBe(true)

    const verticals = lines.filter((l) => l.points[0] === l.points[2])
    for (const v of verticals) {
      const xWorld = Math.round(v.points[0] - VP.originX)
      const expectedMajor = xWorld % 10 === 0
      expect(v.major).toBe(expectedMajor)
    }
  })

  test('uses Math.round so negative indices that are multiples of majorEvery are still major', () => {
    // spacing 25_000, so x = -250_000 is index -10 and must be major.
    const v = { scale: 0.001, originX: 400, originY: 300 }
    const lines = computeGridLines(v, 800, 600, 25_000)
    const horizontals = lines.filter((l) => l.points[1] !== l.points[3])
    // The vertical at world x ~ 0 and at x ~ -250_000 should both be major.
    const verticals = lines.filter((l) => l.points[0] === l.points[2])
    const majors = verticals.filter((l) => l.major).map((l) => Math.round((l.points[0] - 400) / 0.001))
    expect(majors).toContain(0)
    // The view spans roughly +/- 400_000 m at scale 0.001, so -250_000 fits in view.
    expect(majors).toContain(-250_000)
    expect(horizontals.length).toBeGreaterThan(0)
  })

  test('returns nothing when too zoomed out', () => {
    const v: Viewport = { scale: 1e-7, originX: 0, originY: 0 }
    expect(computeGridLines(v, 800, 600, 1, 500)).toEqual([])
  })
})

describe('computeGridLabels', () => {
  test('emits one x-label and one z-label per major step intersecting the view', () => {
    // View is 800 x 600 with origin at (400, 300), spacing 1, majorEvery 10:
    // x range = [-400, 400], so x major steps at -400..400 step 10 = 81 entries.
    // z range = [-300, 300] in world (z up = +), so z major steps at -300..300 step 10 = 61 entries.
    // The default 500-line cap blocks this density, so opt into a higher cap.
    const labels = computeGridLabels(VP, 800, 600, 1, 2000)
    const xLabels = labels.filter((l) => l.kind === 'x')
    const zLabels = labels.filter((l) => l.kind === 'z')
    expect(xLabels.length).toBe(81)
    expect(zLabels.length).toBe(61)
    // The origin labels should be present.
    expect(xLabels.find((l) => l.value === 0)?.text).toBe('0')
    expect(zLabels.find((l) => l.value === 0)?.text).toBe('0')
  })

  test('returns an empty array when the line cap is exceeded', () => {
    const v: Viewport = { scale: 1e-7, originX: 0, originY: 0 }
    expect(computeGridLabels(v, 800, 600, 1, 500)).toEqual([])
  })

  test('screenPos tracks the pan/zoom transform for both axes', () => {
    const labels = computeGridLabels(VP, 800, 600, 1, 2000)
    const x10 = labels.find((l) => l.kind === 'x' && l.value === 10)
    const zNeg10 = labels.find((l) => l.kind === 'z' && l.value === -10)
    // world x=10 -> screen 410 at scale 1, originX 400
    expect(x10?.screenPos).toBeCloseTo(410, 6)
    // world z=-10 -> screen 310 (sy = originY - z*scale = 300 - (-10) = 310)
    expect(zNeg10?.screenPos).toBeCloseTo(310, 6)
  })
})

describe('formatAxisValue', () => {
  test('formats zero without a unit', () => {
    expect(formatAxisValue(0)).toBe('0')
    expect(formatAxisValue(0.4)).toBe('0')
    expect(formatAxisValue(-0.4)).toBe('0')
  })

  test('formats sub-kilometer values as meters', () => {
    expect(formatAxisValue(500)).toBe('500 m')
    expect(formatAxisValue(-500)).toBe('-500 m')
    expect(formatAxisValue(999)).toBe('999 m')
  })

  test('formats kilometer values with trimmed fractional digits', () => {
    expect(formatAxisValue(1000)).toBe('1 km')
    expect(formatAxisValue(-1000)).toBe('-1 km')
    expect(formatAxisValue(10_000)).toBe('10 km')
    expect(formatAxisValue(-25_000)).toBe('-25 km')
    expect(formatAxisValue(12_500)).toBe('12.5 km')
    expect(formatAxisValue(12_340)).toBe('12.34 km')
  })
})
