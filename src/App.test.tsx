import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import App from './App'

afterEach(cleanup)

test('renders the app bar and the control panel', () => {
  render(<App />)
  expect(screen.getByText('poly-forge')).toBeTruthy()
  // Control panel content (the canvas Stage is not mounted in jsdom).
  expect(screen.getByText('Statistics')).toBeTruthy()
  expect(screen.getByText('Add geometry')).toBeTruthy()
  expect(screen.getByText('Marquee select')).toBeTruthy()
  expect(screen.getByText('Actions')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Import \.poly/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Export \.poly/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Settings/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Clear/ })).toBeTruthy()
})
