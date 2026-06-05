import { type ReactNode } from 'react'
import { useEditorStore, type MarqueeTarget } from '../store/editorStore'
import { AddCard } from './AddCard'
import { InspectorCard } from './InspectorCard'
import { BulkCard } from './BulkCard'
import { AppActions } from './AppActions'
import { PointsSection } from './PointsSection'
import { LinesSection } from './LinesSection'
import { FacesSection } from './FacesSection'

const MARQUEE_OPTIONS: { id: MarqueeTarget; label: string }[] = [
  { id: 'point', label: 'Points' },
  { id: 'line', label: 'Segments' },
  { id: 'face', label: 'Faces' },
]

function MarqueeToggle() {
  const marqueeTarget = useEditorStore((s) => s.marqueeTarget)
  const setMarqueeTarget = useEditorStore((s) => s.setMarqueeTarget)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="inline-flex rounded-md border border-neutral-200 p-0.5 dark:border-neutral-700">
        {MARQUEE_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setMarqueeTarget(o.id)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              marqueeTarget === o.id
                ? 'bg-violet-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Drag to marquee-select fully-enclosed objects. Hold{' '}
        <kbd className="font-mono">Shift</kbd> for segments, <kbd className="font-mono">Ctrl</kbd>{' '}
        for faces. <kbd className="font-mono">Ctrl</kbd>/<kbd className="font-mono">Shift</kbd>+click
        to add or remove from the selection.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-md bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
      <span className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
    </div>
  )
}

export function ControlPanel() {
  const nPoints = useEditorStore((s) => s.points.length)
  const nLines = useEditorStore((s) => s.lines.length)
  const nFaces = useEditorStore((s) => s.faces.length)

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-neutral-900">
      <Section title="Actions">
        <AppActions />
      </Section>

      <Section title="Inspector">
        <InspectorCard />
      </Section>

      <Section title="Add geometry">
        <AddCard />
      </Section>

      <Section title="Marquee select">
        <MarqueeToggle />
      </Section>

      <Section title="Bulk edit">
        <BulkCard />
      </Section>

      <Section title="Statistics">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Points" value={nPoints} />
          <Stat label="Lines" value={nLines} />
          <Stat label="Faces" value={nFaces} />
        </div>
      </Section>

      <PointsSection />
      <LinesSection />
      <FacesSection />
    </div>
  )
}
