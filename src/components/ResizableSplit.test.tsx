import { describe, expect, test } from 'vitest'
import { clampLeftPx } from './resizableSplitClamp'

describe('clampLeftPx', () => {
  test('keeps values inside the [min, max] range untouched', () => {
    expect(clampLeftPx(320, 280, 520)).toBe(320)
    expect(clampLeftPx(280, 280, 520)).toBe(280)
    expect(clampLeftPx(520, 280, 520)).toBe(520)
  })

  test('clamps below min', () => {
    expect(clampLeftPx(100, 280, 520)).toBe(280)
    expect(clampLeftPx(-50, 280, 520)).toBe(280)
  })

  test('clamps above max', () => {
    expect(clampLeftPx(800, 280, 520)).toBe(520)
    expect(clampLeftPx(521, 280, 520)).toBe(520)
  })
})
