import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FacesSection } from './FacesSection'
import { useEditorStore } from '../store/editorStore'
import { defaultSettings, useSettingsStore } from '../store/settingsStore'

afterEach(cleanup)

function buildSquare() {
  const s = useEditorStore.getState()
  const a = s.addPoint(0, 0)
  const b = s.addPoint(100, 0)
  const c = s.addPoint(100, -100)
  const d = s.addPoint(0, -100)
  s.addLine(a, b)
  s.addLine(b, c)
  s.addLine(c, d)
  s.addLine(d, a)
}

beforeEach(() => {
  useEditorStore.getState().reset()
  useSettingsStore.getState().hydrate(defaultSettings())
  localStorage.clear()
})

describe('FacesSection Type cell (A-23)', () => {
  test('empty -> integer creates a faceTypes entry', () => {
    buildSquare()
    const faceId = useEditorStore.getState().faces[0].id
    render(<FacesSection />)
    // The Type cell shows "—" (em-dash) for an untyped face.
    const dash = screen.getByText('—')
    fireEvent.doubleClick(dash.closest('td')!)
    const input = screen.getByDisplayValue('') as HTMLInputElement
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useEditorStore.getState().faceTypes[faceId]).toEqual({ mattype: 3, size: -1 })
  })

  test('integer -> integer updates mattype while preserving size', () => {
    buildSquare()
    const faceId = useEditorStore.getState().faces[0].id
    useEditorStore.getState().setFaceType(faceId, 2, 7)
    render(<FacesSection />)
    fireEvent.doubleClick(screen.getByText('2').closest('td')!)
    const input = screen.getByDisplayValue('2') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useEditorStore.getState().faceTypes[faceId]).toEqual({ mattype: 5, size: 7 })
  })

  test('integer -> empty clears the faceTypes entry', () => {
    buildSquare()
    const faceId = useEditorStore.getState().faces[0].id
    useEditorStore.getState().setFaceType(faceId, 4)
    render(<FacesSection />)
    fireEvent.doubleClick(screen.getByText('4').closest('td')!)
    const input = screen.getByDisplayValue('4') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useEditorStore.getState().faceTypes[faceId]).toBeUndefined()
  })

  test('non-integer input is rejected (no commit)', () => {
    buildSquare()
    const faceId = useEditorStore.getState().faces[0].id
    useEditorStore.getState().setFaceType(faceId, 2)
    render(<FacesSection />)
    fireEvent.doubleClick(screen.getByText('2').closest('td')!)
    const input = screen.getByDisplayValue('2') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2.5' } })
    // Blur with invalid -> revert; faceTypes unchanged.
    fireEvent.blur(input)
    expect(useEditorStore.getState().faceTypes[faceId]?.mattype).toBe(2)
  })
})
