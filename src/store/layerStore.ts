import { create } from 'zustand'

export type LayerKey = 'grid' | 'points' | 'lines' | 'faces'

/** All layers share an off/on/labeled cycle; `labeled` overlays IDs or values. */
export type LayerMode = 'off' | 'on' | 'labeled'

export interface LayerVisibility {
  grid: LayerMode
  points: LayerMode
  lines: LayerMode
  faces: LayerMode
}

export interface LayerState extends LayerVisibility {
  toggle: (layer: LayerKey) => void
  setLayer: (layer: LayerKey, mode: LayerMode) => void
  setAll: (visible: boolean) => void
  hydrate: (v: LayerVisibility) => void
}

const STORAGE_KEY = 'poly-forge:layers:v1'

const CYCLE: Record<LayerMode, LayerMode> = { off: 'on', on: 'labeled', labeled: 'off' }

export function defaultLayerVisibility(): LayerVisibility {
  return { grid: 'on', points: 'on', lines: 'on', faces: 'on' }
}

function coerceMode(v: unknown): LayerMode | null {
  if (v === 'off' || v === 'on' || v === 'labeled') return v
  // Migration: pre-tri-state shape stored a plain boolean per key.
  if (typeof v === 'boolean') return v ? 'on' : 'off'
  return null
}

export function loadLayerVisibility(): LayerVisibility | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    const grid = coerceMode(o.grid)
    const points = coerceMode(o.points)
    const lines = coerceMode(o.lines)
    const faces = coerceMode(o.faces)
    if (!grid || !points || !lines || !faces) return null
    return { grid, points, lines, faces }
  } catch {
    return null
  }
}

export function saveLayerVisibility(v: LayerVisibility): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {
    /* storage may be unavailable (private mode, quota); ignore */
  }
}

export const useLayerStore = create<LayerState>((set) => ({
  ...defaultLayerVisibility(),

  toggle: (layer) =>
    set((s) => ({ [layer]: CYCLE[s[layer]] }) as Partial<LayerVisibility>),
  setLayer: (layer, mode) => set({ [layer]: mode } as Partial<LayerVisibility>),
  setAll: (visible) => {
    const mode: LayerMode = visible ? 'on' : 'off'
    set({ grid: mode, points: mode, lines: mode, faces: mode })
  },
  hydrate: (v) => set({ grid: v.grid, points: v.points, lines: v.lines, faces: v.faces }),
}))
