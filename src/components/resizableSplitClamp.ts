/** Pure clamp helper so the math is testable independently of React. */
export function clampLeftPx(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
