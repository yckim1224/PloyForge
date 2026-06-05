import { useRef, useState } from 'react'
import { Modal } from './Modal'

export interface InputFieldOption {
  label: string
  value: number
}

export interface InputField {
  key: string
  label: string
  type: 'number' | 'select'
  initialValue?: string | number
  options?: InputFieldOption[]
  min?: number
  step?: number
  required?: boolean
}

export interface InputModalProps {
  open: boolean
  title: string
  fields: InputField[]
  onCancel: () => void
  onConfirm: (values: Record<string, string | number>) => void
  confirmLabel?: string
}

function initialFor(f: InputField): string {
  if (f.initialValue !== undefined) return String(f.initialValue)
  if (f.type === 'select' && f.options && f.options.length > 0) return String(f.options[0].value)
  return ''
}

function parseField(f: InputField, raw: string): { ok: boolean; value: string | number } {
  if (f.type === 'number') {
    if (raw === '' || raw === null) {
      if (f.required) return { ok: false, value: raw }
      return { ok: true, value: '' }
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) return { ok: false, value: raw }
    if (typeof f.min === 'number' && n < f.min) return { ok: false, value: raw }
    return { ok: true, value: n }
  }
  // select
  if (raw === '' && !f.required) return { ok: true, value: '' }
  const n = Number(raw)
  if (!Number.isFinite(n)) return { ok: false, value: raw }
  return { ok: true, value: n }
}

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'
const labelClass = 'text-xs text-neutral-500 dark:text-neutral-400'

interface FormProps {
  fields: InputField[]
  onCancel: () => void
  onConfirm: (values: Record<string, string | number>) => void
  confirmLabel: string
  firstFieldRef: React.RefObject<HTMLElement | null>
}

/**
 * Inner form: re-mounted on every open so caller's `initialValue` always wins
 * without a useEffect-driven state reset.
 */
function InputForm({ fields, onCancel, onConfirm, confirmLabel, firstFieldRef }: FormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, initialFor(f)])),
  )
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const out: Record<string, string | number> = {}
    for (const f of fields) {
      const raw = values[f.key] ?? ''
      const parsed = parseField(f, raw)
      if (!parsed.ok) {
        setError(`Invalid value for ${f.label}`)
        return
      }
      out[f.key] = parsed.value
    }
    setError(null)
    onConfirm(out)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex flex-col gap-3"
    >
      {fields.map((f, idx) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className={labelClass}>{f.label}</span>
          {f.type === 'select' ? (
            <select
              ref={idx === 0 ? (firstFieldRef as React.Ref<HTMLSelectElement>) : undefined}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={inputClass}
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              ref={idx === 0 ? (firstFieldRef as React.Ref<HTMLInputElement>) : undefined}
              type="number"
              step={f.step ?? 'any'}
              min={f.min}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={inputClass}
            />
          )}
        </label>
      ))}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  )
}

/** Multi-field input modal that submits parsed values on confirm. */
export function InputModal({
  open,
  title,
  fields,
  onCancel,
  onConfirm,
  confirmLabel = 'Apply',
}: InputModalProps) {
  // Created here so we can hand it to Modal as initialFocusRef *and* down to
  // InputForm where the actual first input/select is bound. Each open mounts
  // a fresh InputForm so the ref always wires to the current first field.
  const firstFieldRef = useRef<HTMLElement>(null)
  return (
    <Modal open={open} onClose={onCancel} title={title} initialFocusRef={firstFieldRef}>
      {open && (
        <InputForm
          fields={fields}
          onCancel={onCancel}
          onConfirm={onConfirm}
          confirmLabel={confirmLabel}
          firstFieldRef={firstFieldRef}
        />
      )}
    </Modal>
  )
}
