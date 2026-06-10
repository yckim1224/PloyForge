import { CollapsibleSection } from '../components/CollapsibleSection'
import { AppActions } from './AppActions'
import { BackgroundSection } from './BackgroundSection'
import { PointsSection } from './PointsSection'
import { LinesSection } from './LinesSection'
import { FacesSection } from './FacesSection'

export function ControlPanel() {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-neutral-900">
      <CollapsibleSection title="Actions">
        <AppActions />
      </CollapsibleSection>

      <BackgroundSection />
      <PointsSection />
      <LinesSection />
      <FacesSection />
    </div>
  )
}
