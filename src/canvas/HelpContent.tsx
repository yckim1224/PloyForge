import type { ReactNode } from 'react'

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPad|iPhone/i.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl' // ⌘
const SHIFT_MOD = isMac ? '⇧⌘' : 'Ctrl+⇧' // ⇧⌘

interface Shortcut {
  keys: string[]
  label: string
}

interface Section {
  title: string
  rows: Shortcut[]
}

const SECTIONS: Section[] = [
  {
    title: 'Tools',
    rows: [
      { keys: ['V'], label: 'Select' },
      { keys: ['P'], label: 'Add point' },
      { keys: ['L'], label: 'Add line' },
      { keys: ['H'], label: 'Pan' },
    ],
  },
  {
    title: 'Edit',
    rows: [
      { keys: ['Del'], label: 'Delete selection' },
      { keys: ['Esc'], label: 'Cancel / Deselect' },
      { keys: [MOD, 'Z'], label: 'Undo' },
      { keys: [SHIFT_MOD, 'Z'], label: 'Redo' },
    ],
  },
  {
    title: 'Navigate',
    rows: [
      { keys: ['Space'], label: 'Pan (hold)' },
      { keys: ['← ↑ → ↓'], label: 'Nudge ×1' },
      { keys: ['⇧', '← ↑ → ↓'], label: 'Nudge ×10' },
    ],
  },
  {
    title: 'Snap',
    rows: [
      { keys: ['Alt'], label: 'Bypass snap (free placement)' },
    ],
  },
]

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded border border-white/15 bg-white/10 px-1.5 font-mono text-[10.5px] font-medium leading-none text-white">
      {children}
    </kbd>
  )
}

function KeyCombo({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <Kbd key={i}>{k}</Kbd>
      ))}
    </span>
  )
}

/**
 * Structured help content rendered inside the canvas Help tooltip. Grouped
 * by category with right-aligned key caps and left-aligned descriptions so
 * users can scan a section at a time.
 */
export function HelpContent() {
  return (
    <div className="flex flex-col gap-3 px-1 py-0.5 text-xs">
      {SECTIONS.map((sec) => (
        <section key={sec.title} className="flex flex-col gap-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">
            {sec.title}
          </h4>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
            {sec.rows.map((row, i) => (
              <div key={i} className="contents">
                <span className="flex justify-end">
                  <KeyCombo keys={row.keys} />
                </span>
                <span className="text-white/90">{row.label}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
