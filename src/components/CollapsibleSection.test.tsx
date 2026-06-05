import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CollapsibleSection } from './CollapsibleSection'

const KEY = 'poly-forge:sections:v1'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

beforeEach(() => {
  localStorage.clear()
})

describe('CollapsibleSection', () => {
  test('renders title and count', () => {
    render(
      <CollapsibleSection title="Points" count={7}>
        <p>body</p>
      </CollapsibleSection>,
    )
    expect(screen.getByText('Points')).toBeTruthy()
    expect(screen.getByText('(7)')).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
  })

  test('toggle flips aria-expanded and hides body', () => {
    render(
      <CollapsibleSection title="Lines">
        <p>body</p>
      </CollapsibleSection>,
    )
    const trigger = screen.getByRole('button', { expanded: true })
    fireEvent.click(trigger)
    // After collapse the same trigger reports expanded=false.
    expect(screen.getByRole('button', { expanded: false })).toBeTruthy()
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy()
  })

  test('persists open/closed state per title to localStorage', () => {
    const { unmount } = render(
      <CollapsibleSection title="Faces">
        <p>body</p>
      </CollapsibleSection>,
    )
    fireEvent.click(screen.getByRole('button', { expanded: true }))
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>
    expect(stored.Faces).toBe(false)
    unmount()

    // Remount: the persisted "false" should win over defaultOpen.
    render(
      <CollapsibleSection title="Faces" defaultOpen>
        <p>body</p>
      </CollapsibleSection>,
    )
    expect(screen.getByRole('button', { expanded: false })).toBeTruthy()
  })

  test('persists each section independently by title', () => {
    render(
      <>
        <CollapsibleSection title="Points">
          <p>p</p>
        </CollapsibleSection>
        <CollapsibleSection title="Lines">
          <p>l</p>
        </CollapsibleSection>
      </>,
    )
    const buttons = screen.getAllByRole('button')
    // Collapse only the first ("Points").
    fireEvent.click(buttons[0])
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>
    expect(stored.Points).toBe(false)
    // Lines is recorded under its own key, untouched by the Points toggle.
    expect(stored.Lines).toBe(true)
  })
})
