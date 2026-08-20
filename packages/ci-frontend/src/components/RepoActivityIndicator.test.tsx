import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RepoActivityIndicator } from './RepoActivityIndicator'
import type { RepositorySnapshot } from '../api/types'

const base: RepositorySnapshot = {
  name: 'r', htmlUrl: '', private: true, workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [],
}

describe('RepoActivityIndicator', () => {
  it('shows a PR badge only when there are open PRs', () => {
    const { rerender } = render(<RepoActivityIndicator repository={base} />)
    expect(screen.queryByText(/PR$/)).toBeNull()
    rerender(<RepoActivityIndicator repository={{ ...base, pullRequests: [
      { number: 1, title: 't', author: 'u', htmlUrl: 'u', isDraft: false, createdAt: '2026-05-29T00:00:00Z' },
    ] }} />)
    expect(screen.getByText('1 PR')).toBeInTheDocument()
  })

  it('marks CI failing and CD running via data-activity', () => {
    render(<RepoActivityIndicator repository={{
      ...base,
      workflows: [{ name: 'ci', file: 'ci.yml', state: 'failure', lastRun: null }],
      deploys: [{ workflow: 'CI', name: 'deploy', state: 'running', htmlUrl: 'u', updatedAt: '2026-05-29T00:00:00Z' }],
    }} />)
    expect(screen.getByLabelText('CI failure')).toBeInTheDocument()
    expect(screen.getByLabelText('CD running')).toBeInTheDocument()
  })
})
