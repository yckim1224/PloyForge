import { create } from 'zustand'

export type LayerKey = 'grid' | 'points' | 'lines' | 'faces'

/** Grid is on/off only; points/lines/faces add a 'labeled' mode that overlays IDs. */
export type LayerMode = 'off' | 'on' | 'labeled'

export interface LayerVisibility {
  grid: boolean
  points: LayerMode
  lines: LayerMode
  faces: LayerMode
}

export interface LayerState extends LayerVisibility {
  toggle: (layer: LayerKey) => void
  setLayer: {
    (layer: 'grid', visible: boolean): void
    (layer: 'points' | 'lines' | 'faces', mode: LayerMode): void
  }
  setAll: (visible: boolean) => void
  hydrate: (v: LayerVisibility) => void
}

const STORAGE_KEY = 'poly-forge:layers:v1'

const CYCLE: Record<LayerMode, LayerMode> = { off: 'on', on: 'labeled', labeled: 'off' }

export function defaultLayerVisibility(): LayerVisibility {
  return { grid: true, points: 'on', lines: 'on', faces: 'on' }
}

function coerceMode(v: unknown): LayerMode | null {
  if (v === 'off' || v === 'on' || v === 'labeled') return v
  // Migration: pre-tri-state shape had booleans for every key.
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
    if (typeof o.grid !== 'boolean') return null
    const points = coerceMode(o.points)
    const lines = coerceMode(o.lines)
    const faces = coerceMode(o.faces)
    if (!points || !lines || !faces) return null
    return { grid: o.grid, points, lines, faces }
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
    set((s) => {
      if (layer === 'grid') return { grid: !s.grid }
      return { [layer]: CYCLE[s[layer]] } as Partial<LayerVisibility>
    }),
  setLayer: ((layer: LayerKey, value: boolean | LayerMode) =>
    set({ [layer]: value } as Partial<LayerVisibility>)) as LayerState['setLayer'],
  setAll: (visible) =>
    set({
      grid: visible,
      points: visible ? 'on' : 'off',
      lines: visible ? 'on' : 'off',
      faces: visible ? 'on' : 'off',
    }),
  hydrate: (v) => set({ grid: v.grid, points: v.points, lines: v.lines, faces: v.faces }),
}))
