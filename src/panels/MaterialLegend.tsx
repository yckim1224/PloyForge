import { useEditorStore } from '../store/editorStore'

export function MaterialLegend() {
  const materials = useEditorStore((s) => s.materials)
  const regions = useEditorStore((s) => s.regions)
  const setMaterial = useEditorStore((s) => s.setMaterial)

  if (materials.length === 0) {
    return (
      <p className="text-xs text-neutral-400">
        No materials yet. Assign a material to a face or region.
      </p>
    )
  }

  const countOf = (mattype: number) => regions.filter((r) => r.mattype === mattype).length

  return (
    <ul className="flex flex-col gap-1.5">
      {materials.map((m) => (
        <li key={m.mattype} className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`Color for mattype ${m.mattype}`}
            value={m.color}
            onChange={(e) => setMaterial(m.mattype, { color: e.target.value })}
            className="size-5 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white p-0"
          />
          <span className="shrink-0 text-sm font-medium text-neutral-700 dark:text-neutral-200">
            mattype {m.mattype}
          </span>
          <input
            type="text"
            placeholder="label"
            defaultValue={m.label ?? ''}
            key={m.label ?? ''}
            onBlur={(e) => setMaterial(m.mattype, { label: e.target.value })}
            className="min-w-0 flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-xs focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <span className="shrink-0 text-xs tabular-nums text-neutral-400">{countOf(m.mattype)}×</span>
        </li>
      ))}
    </ul>
  )
}
