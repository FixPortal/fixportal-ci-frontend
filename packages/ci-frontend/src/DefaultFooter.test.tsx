import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { DefaultFooter } from './DefaultFooter'

afterEach(cleanup)

test('renders the generic tagline and no brand attribution', () => {
  render(<DefaultFooter />)
  expect(screen.getByText('Continuous-integration overview')).toBeInTheDocument()
  expect(screen.queryByText(/Chris Dowling/)).not.toBeInTheDocument()
})
