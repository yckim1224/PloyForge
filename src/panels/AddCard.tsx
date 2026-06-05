import { useRef, useState } from 'react'
import { Button } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { NumberInput } from '../components/fields'
import type { Domain } from '../types'

function readNum(fd: FormData, key: string): number {
  const v = parseFloat(String(fd.get(key) ?? ''))
  return Number.isFinite(v) ? v : 0
}

type Feedback = { kind: 'ok' | 'warn' | 'err'; text: string } | null

function inDomain(d: Domain, x: number, z: number): boolean {
  return x >= d.xmin && x <= d.xmax && z >= d.zmin && z <= d.zmax
}

function FeedbackLine({ fb }: { fb: Feedback }) {
  if (!fb) return null
  const color =
    fb.kind === 'err'
      ? 'text-red-600'
      : fb.kind === 'warn'
        ? 'text-amber-600'
        : 'text-emerald-600'
  return <p className={`text-xs ${color}`}>{fb.text}</p>
}

export function AddCard() {
  const addPoint = useEditorStore((s) => s.addPoint)
  const selectSingle = useEditorStore((s) => s.selectSingle)
  const addLineByCoords = useEditorStore((s) => s.addLineByCoords)
  const domain = useEditorStore((s) => s.domain)
  const pointForm = useRef<HTMLFormElement>(null)
  const lineForm = useRef<HTMLFormElement>(null)
  const [auto, setAuto] = useState(true)
  const [pointFb, setPointFb] = useState<Feedback>(null)
  const [lineFb, setLineFb] = useState<Feedback>(null)

  const onAddPoint = () => {
    if (!pointForm.current) return
    const fd = new FormData(pointForm.current)
    const x = readNum(fd, 'x')
    const z = readNum(fd, 'z')
    selectSingle('point', addPoint(x, z))
    const inside = inDomain(domain, x, z)
    setPointFb({
      kind: inside ? 'ok' : 'warn',
      text: `Added point (${x}, ${z})${inside ? '' : ' — outside the domain extent'}`,
    })
  }

  const onAddLine = () => {
    if (!lineForm.current) return
    const fd = new FormData(lineForm.current)
    const x1 = readNum(fd, 'x1')
    const z1 = readNum(fd, 'z1')
    const x2 = readNum(fd, 'x2')
    const z2 = readNum(fd, 'z2')
    const res = addLineByCoords(x1, z1, x2, z2, auto)
    if (res.error) {
      setLineFb({ kind: 'err', text: res.error })
    } else if (res.lineId === null) {
      setLineFb({ kind: 'warn', text: 'Endpoints coincide; no line added.' })
    } else {
      const outside = !inDomain(domain, x1, z1) || !inDomain(domain, x2, z2)
      setLineFb({
        kind: outside ? 'warn' : 'ok',
        text: `Added line (${x1}, ${z1}) → (${x2}, ${z2})${
          outside ? ' — partly outside the domain' : ''
        }`,
      })
    }
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
        <FeedbackLine fb={pointFb} />
      </form>

      <form ref={lineForm} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput name="x1" label="x1 (m)" />
          <NumberInput name="z1" label="z1 (m)" />
          <NumberInput name="x2" label="x2 (m)" />
          <NumberInput name="z2" label="z2 (m)" />
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
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
        <FeedbackLine fb={lineFb} />
      </form>
    </div>
  )
}
