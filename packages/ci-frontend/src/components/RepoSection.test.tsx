import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RepoSection } from './RepoSection'

describe('RepoSection', () => {
  it('renders label, count, and expanded chevron when not collapsed', () => {
    render(<RepoSection label="Public" count={8} collapsed={false} onToggle={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Public')).toBeInTheDocument()
    expect(screen.getByText('· 8')).toBeInTheDocument()
    expect(btn.textContent).toContain('▾')
  })

  it('renders collapsed chevron and aria-expanded="false" when collapsed', () => {
    render(<RepoSection label="Private" count={3} collapsed={true} onToggle={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(btn.textContent).toContain('▸')
  })

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<RepoSection label="Public" count={8} collapsed={false} onToggle={onToggle} />)
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
