import { render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import App from './App'

afterEach(cleanup)

test('renders the app bar and both panes', () => {
  render(<App />)
  expect(screen.getByText('poly-forge')).toBeTruthy()
  expect(screen.getByText('Render panel (canvas)')).toBeTruthy()
  expect(screen.getByText('Control panel')).toBeTruthy()
  // The resizable divider is present.
  expect(screen.getByRole('separator')).toBeTruthy()
})
