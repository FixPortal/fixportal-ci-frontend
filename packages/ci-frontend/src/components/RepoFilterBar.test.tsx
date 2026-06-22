// src/components/RepoFilterBar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { emptyFilters } from '../lib/applyRepoFilters'
import { RepoFilterBar } from './RepoFilterBar'

function setup(over: Partial<Parameters<typeof RepoFilterBar>[0]> = {}) {
  const props = {
    filters: emptyFilters(),
    isAdmin: true,
    onSearch: vi.fn(),
    onToggleVisibility: vi.fn(),
    onToggleCiStatus: vi.fn(),
    onToggleHasOpenPrs: vi.fn(),
    ...over,
  }
  render(<RepoFilterBar {...props} />)
  return props
}

describe('RepoFilterBar', () => {
  it('renders the visibility group for admins', () => {
    setup({ isAdmin: true })
    expect(screen.getByRole('button', { name: /public/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument()
  })

  it('hides the visibility group for non-admins but keeps the rest', () => {
    setup({ isAdmin: false })
    expect(screen.queryByRole('button', { name: /^public$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /failing/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /has prs/i })).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('fires onSearch as the user types', async () => {
    const { onSearch } = setup()
    await userEvent.type(screen.getByRole('searchbox'), 'a')
    expect(onSearch).toHaveBeenCalledWith('a')
  })

  it('fires the matching toggle handler when a chip is clicked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /failing/i }))
    expect(props.onToggleCiStatus).toHaveBeenCalledWith('failing')
    await userEvent.click(screen.getByRole('button', { name: /has prs/i }))
    expect(props.onToggleHasOpenPrs).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /^public$/i }))
    expect(props.onToggleVisibility).toHaveBeenCalledWith('public')
  })

  it('reflects selected state via aria-pressed', () => {
    const filters = emptyFilters()
    filters.ciStatus.add('failing')
    setup({ filters })
    expect(screen.getByRole('button', { name: /failing/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /passing/i })).toHaveAttribute('aria-pressed', 'false')
  })
})
