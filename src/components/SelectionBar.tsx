import { ChevronDown } from 'lucide-react'
import { Menu, type MenuItem } from './Menu'

export interface SelectionBarProps {
  /** Number of currently selected items. */
  count: number
  /** Display noun (e.g. "point", "line", "face"); pluralized with a trailing "s". */
  noun: string
  /** Drop-down items shown when count > 0. */
  items: MenuItem[]
}

/**
 * Footer bar that shows the current selection size and exposes bulk actions.
 * The trigger is disabled (and rendered visually muted) when nothing is
 * selected so the user can still see the count.
 */
export function SelectionBar({ count, noun, items }: SelectionBarProps) {
  const disabled = count === 0
  const label = `${count} ${noun}${count === 1 ? '' : 's'} selected`
  const trigger = (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed border-neutral-200 text-neutral-300 dark:border-neutral-800 dark:text-neutral-600'
          : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'
      }`}
    >
      {label}
      <ChevronDown className="size-3" />
    </span>
  )
  return (
    <div className="mt-2">
      {disabled ? trigger : <Menu trigger={trigger} items={items} align="left" />}
    </div>
  )
}
