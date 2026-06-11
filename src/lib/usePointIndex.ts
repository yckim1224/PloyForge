import { useMemo } from 'react'
import type { Point } from '../types'

/** Memoized point id -> display-index (array slot) lookup, shared by panel tables. */
export function usePointIndex(points: Point[]): Map<string, number> {
  return useMemo(() => {
    const m = new Map<string, number>()
    points.forEach((p, i) => m.set(p.id, i))
    return m
  }, [points])
}
