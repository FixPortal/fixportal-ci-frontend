import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { RepositorySnapshot } from '../api/types'
import { RepoBoard } from './RepoBoard'

function repo(over: Partial<RepositorySnapshot>): RepositorySnapshot {
  return {
    name: 'fixportal-docs', htmlUrl: '', private: false,
    workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [],
    ...over,
  }
}

describe('RepoBoard GitHub link', () => {
  it('always renders a GitHub link pointing to htmlUrl', () => {
    render(
      <RepoBoard
        repository={repo({ htmlUrl: 'https://github.com/FixPortal/fixportal-docs' })}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    const link = screen.getByRole('link', { name: /open fixportal-docs on github/i })
    expect(link).toHaveAttribute('href', 'https://github.com/FixPortal/fixportal-docs')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders the GitHub link for private repos without admin gating', () => {
    render(
      <RepoBoard
        repository={repo({ name: 'fixportal-engine', htmlUrl: 'https://github.com/FixPortal/fixportal-engine', private: true })}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByRole('link', { name: /open fixportal-engine on github/i })).toBeInTheDocument()
  })
})

describe('RepoBoard No-CI treatment', () => {
  it('marks a zero-workflow repo with the No-CI class and a "No CI" tag', () => {
    const { container } = render(
      <RepoBoard repository={repo({ workflows: [] })} collapsed onToggle={() => {}} />,
    )
    expect(container.querySelector('.repo-board--no-ci')).not.toBeNull()
    expect(screen.getByText('No CI')).toBeInTheDocument()
  })

  it('does not mark a repo that has workflows', () => {
    const withWf = repo({
      workflows: [{ name: 'ci', file: 'ci.yml', state: 'success', lastRun: null }],
    })
    const { container } = render(<RepoBoard repository={withWf} collapsed onToggle={() => {}} />)
    expect(container.querySelector('.repo-board--no-ci')).toBeNull()
    expect(screen.queryByText('No CI')).not.toBeInTheDocument()
  })
})
