const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums text-neutral-800 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'
const labelClass = 'text-xs text-neutral-500 dark:text-neutral-400'

/** Uncontrolled numeric input (read via FormData on submit); accepts decimals/scientific. */
export function NumberInput({
  name,
  label,
  defaultValue = 0,
}: {
  name: string
  label: string
  defaultValue?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <input name={name} type="text" inputMode="decimal" defaultValue={String(defaultValue)} className={inputClass} />
    </label>
  )
}

/** Controlled numeric field for live-editing selected elements. */
export function NumberValue({
  label,
  value,
  onCommit,
  step = 'any',
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  step?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        step={step}
        defaultValue={value}
        key={value}
        onBlur={(e) => {
          const n = e.target.valueAsNumber
          if (Number.isFinite(n)) onCommit(n)
        }}
        className={inputClass}
      />
    </label>
  )
}
