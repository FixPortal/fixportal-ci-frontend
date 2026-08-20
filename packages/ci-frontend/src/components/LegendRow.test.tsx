import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { LegendRow } from './LegendRow'

describe('LegendRow', () => {
  it('renders collapsed by default', () => {
    render(<LegendRow />)
    expect(screen.getByRole('button', { name: /legend/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('passing')).not.toBeInTheDocument()
  })

  it('expands and shows all status items on toggle', async () => {
    render(<LegendRow />)
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    expect(screen.getByRole('button', { name: /legend/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('passing')).toBeInTheDocument()
    expect(screen.getByText('failing')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('No-CI')).toBeInTheDocument()
  })

  it('expands and shows Lizard metric definitions on toggle', async () => {
    render(<LegendRow />)
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    expect(screen.getByText(/non-comment lines/)).toBeInTheDocument()
    expect(screen.getByText(/cyclomatic complexity/)).toBeInTheDocument()
    expect(screen.getByText(/functions over CCN/)).toBeInTheDocument()
  })

  it('explains that the GitHub scanning pills are public-repo only', async () => {
    // The absence of a CodeQL / Code Quality / Secret Scanning pill on a private repo is
    // deliberate, not a stalled reviewer. Nothing on the row itself can say so, so the
    // legend is the only place a reader can find out.
    render(<LegendRow />)
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    expect(screen.getByText(/public repositories only/)).toBeInTheDocument()
  })

  it('collapses again on second click', async () => {
    render(<LegendRow />)
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    expect(screen.queryByText('passing')).not.toBeInTheDocument()
  })
})
