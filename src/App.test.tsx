import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import App from './App'

afterEach(cleanup)

test('renders the app bar and the control panel', () => {
  render(<App />)
  expect(screen.getByText('poly-forge')).toBeTruthy()
  // Control panel structure: Actions header + collapsible Points/Lines/Faces.
  expect(screen.getByText('Actions')).toBeTruthy()
  expect(screen.getByText('Points')).toBeTruthy()
  expect(screen.getByText('Lines')).toBeTruthy()
  expect(screen.getByText('Faces')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Import \.poly/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Export \.poly/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Settings/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Clear/ })).toBeTruthy()
})
