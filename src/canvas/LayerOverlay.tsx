import { Circle, Eye, EyeOff, Grid3x3, Hexagon, Image as ImageIcon, Spline } from 'lucide-react'
import { useLayerStore, type LayerKey, type LayerMode } from '../store/layerStore'
import { useEditorStore } from '../store/editorStore'

const LAYERS: { id: LayerKey; label: string; Icon: typeof Grid3x3 }[] = [
  { id: 'grid', label: 'Grid', Icon: Grid3x3 },
  { id: 'points', label: 'Points', Icon: Circle },
  { id: 'lines', label: 'Lines', Icon: Spline },
  { id: 'faces', label: 'Faces', Icon: Hexagon },
]

function modeLabel(mode: LayerMode): string {
  return mode === 'labeled' ? 'on + IDs' : mode
}

export function LayerOverlay() {
  const grid = useLayerStore((s) => s.grid)
  const points = useLayerStore((s) => s.points)
  const lines = useLayerStore((s) => s.lines)
  const faces = useLayerStore((s) => s.faces)
  const toggle = useLayerStore((s) => s.toggle)
  const setAll = useLayerStore((s) => s.setAll)

  const background = useEditorStore((s) => s.background)
  const backgroundVisible = useEditorStore((s) => s.backgroundVisible)
  const setBackgroundVisible = useEditorStore((s) => s.setBackgroundVisible)

  // Show-all / hide-all sweep the background layer along with the others.
  const showAll = () => {
    setAll(true)
    setBackgroundVisible(true)
  }
  const hideAll = () => {
    setAll(false)
    setBackgroundVisible(false)
  }

  const state: Record<LayerKey, boolean | LayerMode> = { grid, points, lines, faces }

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
        onClick={showAll}
        className="flex size-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <Eye className="size-4" />
      </button>
      <button
        type="button"
        title="Hide all layers"
        aria-label="Hide all layers"
        onClick={hideAll}
        className="flex size-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <EyeOff className="size-4" />
      </button>
      <div className="my-0.5 h-px bg-neutral-200" />
      {LAYERS.map(({ id, label, Icon }) => {
        const v = state[id]
        const off = v === false || v === 'off'
        const labeled = v === 'labeled'
        const title =
          id === 'grid'
            ? `Toggle ${label}`
            : `Toggle ${label} (${modeLabel(v as LayerMode)})`
        return (
          <button
            key={id}
            type="button"
            title={title}
            aria-label={`Toggle ${label}`}
            aria-pressed={!off}
            onClick={() => toggle(id)}
            className={`relative flex size-9 items-center justify-center rounded-md transition-colors ${
              off ? 'text-neutral-400 hover:bg-neutral-100' : 'bg-violet-600 text-white'
            }`}
          >
            <Icon className="size-4" />
            {labeled && (
              <span
                aria-hidden
                data-testid={`label-badge-${id}`}
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-900 text-[9px] font-bold leading-none text-white ring-1 ring-white"
              >
                A
              </span>
            )}
          </button>
        )
      })}
      {background && (
        <>
          <div className="my-0.5 h-px bg-neutral-200" />
          <button
            type="button"
            title={`Toggle background image (${backgroundVisible ? 'on' : 'off'})`}
            aria-label="Toggle background image"
            aria-pressed={backgroundVisible}
            onClick={() => setBackgroundVisible(!backgroundVisible)}
            className={`flex size-9 items-center justify-center rounded-md transition-colors ${
              backgroundVisible
                ? 'bg-violet-600 text-white'
                : 'text-neutral-400 hover:bg-neutral-100'
            }`}
          >
            <ImageIcon className="size-4" />
          </button>
        </>
      )}
    </div>
  )
}
