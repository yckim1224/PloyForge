import { useRef, useState } from 'react'
import { Button } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { NumberInput } from '../components/fields'

function readNum(fd: FormData, key: string): number {
  const v = parseFloat(String(fd.get(key) ?? ''))
  return Number.isFinite(v) ? v : 0
}

export function AddCard() {
  const addPoint = useEditorStore((s) => s.addPoint)
  const selectSingle = useEditorStore((s) => s.selectSingle)
  const addLineByCoords = useEditorStore((s) => s.addLineByCoords)
  const pointForm = useRef<HTMLFormElement>(null)
  const lineForm = useRef<HTMLFormElement>(null)
  const [auto, setAuto] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onAddPoint = () => {
    if (!pointForm.current) return
    const fd = new FormData(pointForm.current)
    selectSingle('point', addPoint(readNum(fd, 'x'), readNum(fd, 'z')))
  }

  const onAddLine = () => {
    if (!lineForm.current) return
    const fd = new FormData(lineForm.current)
    const res = addLineByCoords(
      readNum(fd, 'x1'),
      readNum(fd, 'z1'),
      readNum(fd, 'x2'),
      readNum(fd, 'z2'),
      auto,
    )
    setError(res.error ?? null)
  }

  return (
    <div className="flex flex-col gap-4">
      <form ref={pointForm} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput name="x" label="x (m)" />
          <NumberInput name="z" label="z (m)" />
        </div>
        <Button size="sm" variant="secondary" onPress={onAddPoint}>
          <Plus className="size-4" />
          Add point
        </Button>
      </form>

      <form ref={lineForm} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput name="x1" label="x1 (m)" />
          <NumberInput name="z1" label="z1 (m)" />
          <NumberInput name="x2" label="x2 (m)" />
          <NumberInput name="z2" label="z2 (m)" />
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            className="accent-violet-600"
          />
          Auto-create new points
        </label>
        <Button size="sm" variant="secondary" onPress={onAddLine}>
          <Plus className="size-4" />
          Add line
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </div>
  )
}
