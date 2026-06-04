import { useState, type ReactNode } from 'react'
import { Button } from '@heroui/react'
import { Crosshair, Upload } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { SAMPLES } from '../samples'
import { parsePoly } from '../poly/parse'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-neutral-200 px-4 py-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-md bg-neutral-100 px-3 py-2">
      <span className="text-lg font-semibold tabular-nums text-neutral-900">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  )
}

export function ControlPanel() {
  const loadDocument = useEditorStore((s) => s.loadDocument)
  const requestFit = useEditorStore((s) => s.requestFit)
  const nPoints = useEditorStore((s) => s.points.length)
  const nSegments = useEditorStore((s) => s.segments.length)
  const nRegions = useEditorStore((s) => s.regions.length)
  const [sampleId, setSampleId] = useState(SAMPLES[0].id)

  const handleLoad = () => {
    const s = SAMPLES.find((x) => x.id === sampleId)
    if (!s) return
    loadDocument(parsePoly(s.content).doc)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <Section title="Sample">
        <div className="flex flex-col gap-2">
          <select
            aria-label="Sample file"
            value={sampleId}
            onChange={(e) => setSampleId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 focus:border-violet-500 focus:outline-none"
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

      <Section title="Statistics">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Points" value={nPoints} />
          <Stat label="Segments" value={nSegments} />
          <Stat label="Regions" value={nRegions} />
        </div>
      </Section>
    </div>
  )
}
