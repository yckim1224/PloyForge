import { Circle, Eye, EyeOff, Grid3x3, Hexagon, Spline } from 'lucide-react'
import { useLayerStore, type LayerKey } from '../store/layerStore'

const LAYERS: { id: LayerKey; label: string; Icon: typeof Grid3x3 }[] = [
  { id: 'grid', label: 'Grid', Icon: Grid3x3 },
  { id: 'points', label: 'Points', Icon: Circle },
  { id: 'lines', label: 'Lines', Icon: Spline },
  { id: 'faces', label: 'Faces', Icon: Hexagon },
]

export function LayerOverlay() {
  const grid = useLayerStore((s) => s.grid)
  const points = useLayerStore((s) => s.points)
  const lines = useLayerStore((s) => s.lines)
  const faces = useLayerStore((s) => s.faces)
  const toggle = useLayerStore((s) => s.toggle)
  const setAll = useLayerStore((s) => s.setAll)

  const visible: Record<LayerKey, boolean> = { grid, points, lines, faces }

  return (
    <div
      role="group"
      aria-label="Layer visibility"
      className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur"
    >
      <button
        type="button"
        title="Show all layers"
        aria-label="Show all layers"
        onClick={() => setAll(true)}
        className="flex size-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <Eye className="size-4" />
      </button>
      <button
        type="button"
        title="Hide all layers"
        aria-label="Hide all layers"
        onClick={() => setAll(false)}
        className="flex size-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <EyeOff className="size-4" />
      </button>
      <div className="my-0.5 h-px bg-neutral-200" />
      {LAYERS.map(({ id, label, Icon }) => {
        const on = visible[id]
        return (
          <button
            key={id}
            type="button"
            title={`Toggle ${label}`}
            aria-label={`Toggle ${label}`}
            aria-pressed={on}
            onClick={() => toggle(id)}
            className={`flex size-9 items-center justify-center rounded-md transition-colors ${
              on ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:bg-neutral-100'
            }`}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
