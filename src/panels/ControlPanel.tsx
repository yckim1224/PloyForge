import { type ReactNode } from 'react'
import { AppActions } from './AppActions'
import { PointsSection } from './PointsSection'
import { LinesSection } from './LinesSection'
import { FacesSection } from './FacesSection'

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

export function ControlPanel() {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-neutral-900">
      <Section title="Actions">
        <AppActions />
      </Section>

      <PointsSection />
      <LinesSection />
      <FacesSection />
    </div>
  )
}
