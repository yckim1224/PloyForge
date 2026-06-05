import { useState, type ReactNode } from 'react'
import { Button } from '@heroui/react'
import { Crosshair, Upload } from 'lucide-react'
import { useEditorStore, type MarqueeTarget } from '../store/editorStore'
import { SAMPLES } from '../samples'
import { parsePoly } from '../poly/parse'
import { AddCard } from './AddCard'
import { InspectorCard } from './InspectorCard'
import { BulkCard } from './BulkCard'
import { MaterialLegend } from './MaterialLegend'
import { ImportExportCard } from './ImportExportCard'

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
  const loadDocument = useEditorStore((s) => s.loadDocument)
  const requestFit = useEditorStore((s) => s.requestFit)
  const nPoints = useEditorStore((s) => s.points.length)
  const nSegments = useEditorStore((s) => s.lines.length)
  const nFaces = useEditorStore((s) => s.faces.length)
  const nRegions = useEditorStore((s) => s.regions.length)
  const [sampleId, setSampleId] = useState(SAMPLES[0].id)

  const handleLoad = () => {
    const s = SAMPLES.find((x) => x.id === sampleId)
    if (!s) return
    loadDocument(parsePoly(s.content).doc)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-neutral-900">
      <Section title="Sample">
        <div className="flex flex-col gap-2">
          <select
            aria-label="Sample file"
            value={sampleId}
            onChange={(e) => setSampleId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.description}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onPress={handleLoad}>
              <Upload className="size-4" />
              Load sample
            </Button>
            <Button size="sm" variant="secondary" onPress={requestFit}>
              <Crosshair className="size-4" />
              Fit view
            </Button>
          </div>
        </div>
      </Section>

      <Section title="File">
        <ImportExportCard />
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

      <Section title="Materials">
        <MaterialLegend />
      </Section>

      <Section title="Statistics">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Points" value={nPoints} />
          <Stat label="Segments" value={nSegments} />
          <Stat label="Faces" value={nFaces} />
          <Stat label="Regions" value={nRegions} />
        </div>
      </Section>
    </div>
  )
}
