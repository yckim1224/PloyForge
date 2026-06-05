import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Tooltip } from './Tooltip'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
})

describe('Tooltip', () => {
  test('renders only the trigger initially', () => {
    render(
      <Tooltip content="Hello">
        <button>trigger</button>
      </Tooltip>,
    )
    expect(screen.getByText('trigger')).toBeTruthy()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  test('shows content on mouseenter after delay', () => {
    render(
      <Tooltip content="hover me" delay={100}>
        <button>trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByText('trigger'))
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(screen.getByRole('tooltip').textContent).toContain('hover me')
  })

  test('hides on mouseleave', () => {
    render(
      <Tooltip content="bye" delay={50}>
        <button>trigger</button>
      </Tooltip>,
    )
    const btn = screen.getByText('trigger')
    fireEvent.mouseEnter(btn)
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.mouseLeave(btn)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  test('renders multi-line string content as separate lines', () => {
    render(
      <Tooltip content={'one\ntwo'} delay={0}>
        <button>trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByText('trigger'))
    act(() => {
      vi.advanceTimersByTime(5)
    })
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('one')
    expect(tip.textContent).toContain('two')
    // Each \n splits into its own block-level element.
    expect(tip.querySelectorAll('div').length).toBeGreaterThanOrEqual(2)
  })

  test('wires aria-describedby on the trigger wrapper when open', () => {
    render(
      <Tooltip content="hint" delay={0}>
        <button>trigger</button>
      </Tooltip>,
    )
    const btn = screen.getByText('trigger')
    const wrapper = btn.parentElement as HTMLElement
    expect(wrapper.getAttribute('aria-describedby')).toBeFalsy()
    fireEvent.mouseEnter(wrapper)
    act(() => {
      vi.advanceTimersByTime(5)
    })
    const id = wrapper.getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)?.getAttribute('role')).toBe('tooltip')
  })
})
