import { create } from 'zustand'

export type LayerKey = 'grid' | 'points' | 'lines' | 'faces'

export interface LayerVisibility {
  grid: boolean
  points: boolean
  lines: boolean
  faces: boolean
}

export interface LayerState extends LayerVisibility {
  toggle: (layer: LayerKey) => void
  setLayer: (layer: LayerKey, visible: boolean) => void
  setAll: (visible: boolean) => void
  hydrate: (v: LayerVisibility) => void
}

const STORAGE_KEY = 'poly-forge:layers:v1'

export function defaultLayerVisibility(): LayerVisibility {
  return { grid: true, points: true, lines: true, faces: true }
}

function isValidVisibility(v: unknown): v is LayerVisibility {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.grid === 'boolean' &&
    typeof o.points === 'boolean' &&
    typeof o.lines === 'boolean' &&
    typeof o.faces === 'boolean'
  )
}

export function loadLayerVisibility(): LayerVisibility | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isValidVisibility(parsed)) return null
    return parsed
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

  toggle: (layer) => set((s) => ({ [layer]: !s[layer] } as Partial<LayerVisibility>)),
  setLayer: (layer, visible) => set({ [layer]: visible } as Partial<LayerVisibility>),
  setAll: (visible) =>
    set({ grid: visible, points: visible, lines: visible, faces: visible }),
  hydrate: (v) => set({ grid: v.grid, points: v.points, lines: v.lines, faces: v.faces }),
}))
