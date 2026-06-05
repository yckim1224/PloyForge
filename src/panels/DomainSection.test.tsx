import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DomainSection } from './DomainSection'
import { useEditorStore } from '../store/editorStore'
import { defaultDomain } from '../lib/defaults'

afterEach(() => {
  cleanup()
  useEditorStore.setState({ domain: defaultDomain() })
  localStorage.clear()
})

beforeEach(() => {
  localStorage.clear()
  useEditorStore.setState({ domain: defaultDomain() })
})

function inputByLabel(label: string): HTMLInputElement {
  const node = screen.getByText(label)
  const input = node.parentElement?.querySelector('input')
  if (!input) throw new Error(`No input under label "${label}"`)
  return input as HTMLInputElement
}

describe('DomainSection', () => {
  test('renders the bounds, grid spacing, meshing option, and resolution', () => {
    render(<DomainSection />)
    expect(screen.getByText('Domain')).toBeTruthy()
    expect(screen.getByText('xmin')).toBeTruthy()
    expect(screen.getByText('xmax')).toBeTruthy()
    expect(screen.getByText('zmin')).toBeTruthy()
    expect(screen.getByText('zmax')).toBeTruthy()
    expect(screen.getByText('Grid spacing (m)')).toBeTruthy()
    expect(screen.getByText('Meshing option')).toBeTruthy()
    expect(screen.getByText('Resolution')).toBeTruthy()
  })

  test('editing xmax writes through to editorStore.domain', () => {
    render(<DomainSection />)
    const xmax = inputByLabel('xmax')
    fireEvent.change(xmax, { target: { value: '777777' } })
    fireEvent.blur(xmax)
    expect(useEditorStore.getState().domain.xmax).toBe(777777)
  })

  test('rejects inverted bounds (xmin >= xmax)', () => {
    useEditorStore.getState().setDomain({ xmin: 0, xmax: 100, zmin: -100, zmax: 0 })
    render(<DomainSection />)
    const xmin = inputByLabel('xmin')
    fireEvent.change(xmin, { target: { value: '500' } })
    fireEvent.blur(xmin)
    // Invalid edit is silently dropped; the previous value survives.
    expect(useEditorStore.getState().domain.xmin).toBe(0)
  })

  test('Grid spacing commits to editorStore.domain.gridSpacing', () => {
    render(<DomainSection />)
    const gs = inputByLabel('Grid spacing (m)')
    fireEvent.change(gs, { target: { value: '999' } })
    fireEvent.blur(gs)
    expect(useEditorStore.getState().domain.gridSpacing).toBe(999)
  })
})
