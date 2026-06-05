import { useMemo, type ChangeEvent, type ReactNode } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Modal } from '../components/Modal'
import { useSettingsStore, type BoundaryFlagKey } from '../store/settingsStore'
import { materialColor } from '../constants/materials'
import type { Material } from '../types'

const FLAG_LABELS: { key: BoundaryFlagKey; label: string }[] = [
  { key: 0, label: '0 (Internal)' },
  { key: 1, label: '1 (X0)' },
  { key: 2, label: '2 (X1)' },
  { key: 16, label: '16 (Z0)' },
  { key: 32, label: '32 (Z1)' },
]

const inputClass =
  'rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums text-neutral-800 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-neutral-200 py-3 first:pt-0 last:border-b-0 last:pb-0 dark:border-neutral-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </label>
  )
}

function NumberCell({
  value,
  onCommit,
  step,
  width = 'w-28',
}: {
  value: number
  onCommit: (n: number) => void
  step?: string | number
  width?: string
}) {
  return (
    <input
      type="number"
      step={step ?? 'any'}
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const n = e.target.valueAsNumber
        if (Number.isFinite(n)) onCommit(n)
      }}
      className={`${inputClass} ${width}`}
    />
  )
}

function ColorCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="h-7 w-10 cursor-pointer rounded border border-neutral-300 bg-white p-0 dark:border-neutral-700"
    />
  )
}

function parseDashList(raw: string): number[] {
  if (raw.trim() === '') return []
  const out: number[] = []
  for (const tok of raw.split(',')) {
    const n = Number(tok.trim())
    if (!Number.isFinite(n) || n <= 0) return []
    out.push(n)
  }
  return out
}

function dashListToString(arr: number[]): string {
  return arr.join(',')
}

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const grid = useSettingsStore((s) => s.grid)
  const point = useSettingsStore((s) => s.point)
  const line = useSettingsStore((s) => s.line)
  const materials = useSettingsStore((s) => s.materials)
  const setGrid = useSettingsStore((s) => s.setGrid)
  const setPoint = useSettingsStore((s) => s.setPoint)
  const setLine = useSettingsStore((s) => s.setLine)
  const ensureMaterial = useSettingsStore((s) => s.ensureMaterial)
  const setMaterial = useSettingsStore((s) => s.setMaterial)
  const resetDisplaySettings = useSettingsStore((s) => s.resetDisplaySettings)

  const sortedMaterials = useMemo(
    () => [...materials].sort((a, b) => a.mattype - b.mattype),
    [materials],
  )

  const nextMattype = sortedMaterials.length
    ? Math.max(...sortedMaterials.map((m) => m.mattype)) + 1
    : 0

  const onAddMaterial = () => ensureMaterial(nextMattype)

  const onRemoveMaterial = (mattype: number) => {
    useSettingsStore.setState((s) => ({
      materials: s.materials.filter((m) => m.mattype !== mattype),
    }))
  }

  const onResetMaterialColor = (m: Material) => {
    setMaterial(m.mattype, { color: materialColor(m.mattype) })
  }

  const setFlagStyle = (
    key: BoundaryFlagKey,
    patch: Partial<{ color: string; dash: number[] }>,
  ) => {
    setLine({
      styleByFlag: {
        ...line.styleByFlag,
        [key]: { ...line.styleByFlag[key], ...patch },
      },
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <Group title="Grid">
          <Field label="Line color">
            <ColorCell value={grid.lineColor} onChange={(v) => setGrid({ lineColor: v })} />
          </Field>
          <Field label="Line width (px)">
            <NumberCell
              value={grid.lineWidth}
              onCommit={(v) => setGrid({ lineWidth: v })}
              step="0.5"
              width="w-20"
            />
          </Field>
          <Field label="Show grid">
            <input
              type="checkbox"
              checked={grid.show}
              onChange={(e) => setGrid({ show: e.target.checked })}
              className="size-4"
            />
          </Field>
        </Group>

        <Group title="Point">
          <Field label="Radius (px)">
            <NumberCell
              value={point.radius}
              onCommit={(v) => setPoint({ radius: v })}
              step="0.5"
              width="w-20"
            />
          </Field>
          <Field label="Color">
            <ColorCell value={point.color} onChange={(v) => setPoint({ color: v })} />
          </Field>
          <Field label="Selected color">
            <ColorCell
              value={point.selectedColor}
              onChange={(v) => setPoint({ selectedColor: v })}
            />
          </Field>
        </Group>

        <Group title="Line">
          <Field label="Width (px)">
            <NumberCell
              value={line.width}
              onCommit={(v) => setLine({ width: v })}
              step="0.5"
              width="w-20"
            />
          </Field>
          <div className="mt-1 grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
            <span className="font-medium text-neutral-500 dark:text-neutral-400">BF</span>
            <span className="font-medium text-neutral-500 dark:text-neutral-400">Color</span>
            <span className="font-medium text-neutral-500 dark:text-neutral-400">Dash</span>
            {FLAG_LABELS.map(({ key, label }) => {
              const style = line.styleByFlag[key]
              return (
                <FlagRow
                  key={key}
                  label={label}
                  color={style.color}
                  dash={style.dash}
                  onColor={(v) => setFlagStyle(key, { color: v })}
                  onDash={(arr) => setFlagStyle(key, { dash: arr })}
                />
              )
            })}
          </div>
        </Group>

        <Group title="Materials">
          {sortedMaterials.length === 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              No materials yet. Assign a Type to a face or add one below.
            </p>
          )}
          {sortedMaterials.map((m) => (
            <div
              key={m.mattype}
              className="grid grid-cols-[2.5rem_auto_1fr_auto_auto] items-center gap-2"
            >
              <span className="font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                #{m.mattype}
              </span>
              <ColorCell
                value={m.color}
                onChange={(v) => setMaterial(m.mattype, { color: v })}
              />
              <input
                type="text"
                defaultValue={m.label ?? ''}
                key={m.label ?? ''}
                onBlur={(e) => setMaterial(m.mattype, { label: e.target.value })}
                placeholder="label (optional)"
                className={`${inputClass} w-full`}
              />
              <button
                type="button"
                title="Reset to default color"
                aria-label={`Reset color for mattype ${m.mattype}`}
                onClick={() => onResetMaterialColor(m)}
                className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                title="Remove"
                aria-label={`Remove mattype ${m.mattype}`}
                onClick={() => onRemoveMaterial(m.mattype)}
                className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-neutral-800"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddMaterial}
            className="mt-1 flex items-center gap-1.5 self-start rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Plus className="size-3.5" />
            Add material
          </button>
        </Group>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <button
          type="button"
          onClick={resetDisplaySettings}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          Restore display settings
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

function FlagRow({
  label,
  color,
  dash,
  onColor,
  onDash,
}: {
  label: string
  color: string
  dash: number[]
  onColor: (v: string) => void
  onDash: (arr: number[]) => void
}) {
  return (
    <>
      <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>
      <ColorCell value={color} onChange={onColor} />
      <input
        type="text"
        defaultValue={dashListToString(dash)}
        key={dashListToString(dash)}
        placeholder="e.g. 8,6 (empty = solid)"
        onBlur={(e) => {
          const arr = parseDashList(e.target.value)
          onDash(arr)
        }}
        className={`${inputClass} w-full`}
      />
    </>
  )
}
