import type { ReactNode } from 'react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { useEditorStore } from '../store/editorStore'

const inputClass =
  'rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums text-neutral-800 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

function Field({ label, children }: { label: string; children: ReactNode }) {
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
  width = 'w-24',
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

/**
 * Document-level domain panel: bounds, grid spacing, meshing option, resolution.
 * These fields round-trip through the .poly file and live on editorStore.domain,
 * not in the display-only settingsStore.
 */
export function DomainSection() {
  const domain = useEditorStore((s) => s.domain)
  const setDomain = useEditorStore((s) => s.setDomain)

  return (
    <CollapsibleSection title="Domain">
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="xmin">
            <NumberCell
              value={domain.xmin}
              // Reject inverted bounds; the cell snaps back via key + defaultValue.
              onCommit={(v) => { if (v < domain.xmax) setDomain({ xmin: v }) }}
            />
          </Field>
          <Field label="xmax">
            <NumberCell
              value={domain.xmax}
              onCommit={(v) => { if (v > domain.xmin) setDomain({ xmax: v }) }}
            />
          </Field>
          <Field label="zmin">
            <NumberCell
              value={domain.zmin}
              onCommit={(v) => { if (v < domain.zmax) setDomain({ zmin: v }) }}
            />
          </Field>
          <Field label="zmax">
            <NumberCell
              value={domain.zmax}
              onCommit={(v) => { if (v > domain.zmin) setDomain({ zmax: v }) }}
            />
          </Field>
        </div>
        <Field label="Grid spacing (m)">
          <NumberCell
            value={domain.gridSpacing}
            onCommit={(v) => { if (v > 0) setDomain({ gridSpacing: v }) }}
          />
        </Field>
        <Field label="Meshing option">
          <select
            value={domain.meshingOption}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v === 90 || v === 91) setDomain({ meshingOption: v })
            }}
            className={`${inputClass} w-44`}
          >
            <option value={90}>90 (absolute sizes)</option>
            <option value={91}>91 (size as ratio)</option>
          </select>
        </Field>
        <Field label="Resolution">
          <NumberCell
            value={domain.resolution}
            onCommit={(v) => setDomain({ resolution: v })}
          />
        </Field>
      </div>
    </CollapsibleSection>
  )
}
