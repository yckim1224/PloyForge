import { useState } from 'react'
import { Button } from '@heroui/react'
import { Eraser, Wand2 } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { BOUNDARY_OPTIONS_2D } from '../poly/boundary'

const selectClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'
const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

export function BulkCard() {
  const lines = useEditorStore((s) => s.lines)
  const faces = useEditorStore((s) => s.faces)
  const autoAssign = useEditorStore((s) => s.autoAssignBoundaryFlags)
  const setLineFlag = useEditorStore((s) => s.setLineFlag)
  const applyFaceMaterial = useEditorStore((s) => s.applyFaceMaterial)
  const removeOrphanRegions = useEditorStore((s) => s.removeOrphanRegions)
  const [flag, setFlag] = useState(0)
  const [mattype, setMattype] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      <Button size="sm" variant="secondary" onPress={() => autoAssign()}>
        <Wand2 className="size-4" />
        Auto-assign boundary flags (all)
      </Button>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-neutral-500">Set all segments flag</span>
          <select
            value={flag}
            onChange={(e) => setFlag(Number(e.target.value))}
            className={selectClass}
          >
            {BOUNDARY_OPTIONS_2D.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.value})
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => setLineFlag(lines.map((s) => s.id), flag)}
        >
          Apply
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Fill all faces with mattype
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={mattype}
            onChange={(e) => setMattype(Math.max(0, Math.round(e.target.valueAsNumber || 0)))}
            className={inputClass}
          />
        </label>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => applyFaceMaterial(faces.map((f) => f.id), { mattype })}
        >
          Apply
        </Button>
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Filling a face drops a region seed at its center, turning it into a DES3D region.
      </p>

      <Button size="sm" variant="secondary" onPress={removeOrphanRegions}>
        <Eraser className="size-4" />
        Remove orphaned regions
      </Button>
    </div>
  )
}
