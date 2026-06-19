import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusLegend } from './StatusLegend'

describe('StatusLegend', () => {
  it('decodes every status the board uses', () => {
    render(<StatusLegend />)
    expect(screen.getByText('passing')).toBeInTheDocument()
    expect(screen.getByText('failing')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('No-CI repo')).toBeInTheDocument()
  })

  it('is labelled as the status key for assistive tech', () => {
    render(<StatusLegend />)
    expect(screen.getByLabelText('Status colour key')).toBeInTheDocument()
  })
})
