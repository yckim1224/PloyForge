import { Circle, Hand, MousePointer2, Spline, Trash2 } from 'lucide-react'
import { useEditorStore, type Tool } from '../store/editorStore'

const TOOLS: { id: Tool; label: string; Icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select (V)', Icon: MousePointer2 },
  { id: 'point', label: 'Add point (P)', Icon: Circle },
  { id: 'line', label: 'Add line (L)', Icon: Spline },
  { id: 'pan', label: 'Pan (H, or hold Space)', Icon: Hand },
]

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const deleteSelection = useEditorStore((s) => s.deleteSelection)
  const hasSelection = useEditorStore(
    (s) =>
      s.selection.pointIds.length +
        s.selection.lineIds.length +
        s.selection.faceIds.length >
      0,
  )

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur">
      {TOOLS.map(({ id, label, Icon }) => {
        const active = tool === id
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTool(id)}
            className={`flex size-9 items-center justify-center rounded-md transition-colors ${
              active ? 'bg-violet-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
      <div className="my-0.5 h-px bg-neutral-200" />
      <button
        type="button"
        title="Delete selection (Del)"
        aria-label="Delete selection"
        onClick={deleteSelection}
        disabled={!hasSelection}
        className={`flex size-9 items-center justify-center rounded-md transition-colors ${
          hasSelection ? 'text-red-600 hover:bg-red-50' : 'cursor-not-allowed text-neutral-300'
        }`}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}
