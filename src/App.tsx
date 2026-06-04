import { Hammer } from 'lucide-react'
import { ResizableSplit } from './components/ResizableSplit'
import { EditorStage } from './canvas/EditorStage'
import { ControlPanel } from './panels/ControlPanel'

function AppBar() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4">
      <Hammer className="size-5 text-violet-600" />
      <h1 className="text-sm font-semibold tracking-tight text-neutral-900">poly-forge</h1>
      <span className="text-xs text-neutral-400">
        DES3D <code className="font-mono">.poly</code> editor
      </span>
    </header>
  )
}

function App() {
  return (
    <div className="flex h-full w-full flex-col">
      <AppBar />
      <div className="min-h-0 flex-1">
        <ResizableSplit left={<EditorStage />} right={<ControlPanel />} />
      </div>
    </div>
  )
}

export default App
