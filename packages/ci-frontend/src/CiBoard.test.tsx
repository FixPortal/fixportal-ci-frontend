import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardSnapshot } from './api/types'
import { CiBoard } from './CiBoard'

const snapshot: DashboardSnapshot = {
  refreshedAt: '2026-07-16T10:00:00Z',
  org: 'FixPortal',
  repositories: [
    {
      name: 'ci-frontend',
      htmlUrl: '',
      private: false,
      workflows: [],
      pullRequests: [],
      metrics: null,
      deploys: [],
      packages: [],
    },
  ],
  summary: [],
  lastMergedPr: null,
}

describe('CiBoard landmark structure', () => {
  beforeEach(() => localStorage.clear())

  it('renders the wordmark as the page h1 and a skip link as the first control', async () => {
    render(
      <CiBoard
        adminSignal={false}
        snapshotFetcher={async () => snapshot}
        storageNamespace="a11y-structure"
      />,
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'CI Dashboard' })).toBeInTheDocument()
    // Namespaced target id: co-hosted boards on one page must not collide.
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#ci-main-a11y-structure')
    expect(document.getElementById('ci-main-a11y-structure')).not.toBeNull()
  })
})

describe('CiBoard admin source gating', () => {
  beforeEach(() => localStorage.clear())

  it('stays guest-only when the admin signal has no privileged source', async () => {
    render(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => snapshot}
        storageNamespace="guest-source"
      />,
    )

    expect(await screen.findByText('ci-frontend')).toBeInTheDocument()
    expect(screen.getByText(/\[Guest\]/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Visibility' })).not.toBeInTheDocument()
  })

  it('enables admin presentation when a privileged source is configured', async () => {
    render(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => snapshot}
        adminSnapshotFetcher={async () => snapshot}
        storageNamespace="admin-source"
      />,
    )

    expect(await screen.findByText('ci-frontend')).toBeInTheDocument()
    expect(screen.getByText(/\[Admin\]/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Visibility' })).toBeInTheDocument()
  })

  it('updates a controlled repository scope when the host rerenders', async () => {
    const { rerender } = render(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => snapshot}
        adminSnapshotFetcher={async () => snapshot}
        repositoryScope="fixportal/CI-FRONTEND"
        storageNamespace="controlled-scope"
      />,
    )

    expect(await screen.findByText('ci-frontend')).toBeInTheDocument()
    expect(screen.getByText(/1 of 1 repositories/)).toBeInTheDocument()

    rerender(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => snapshot}
        adminSnapshotFetcher={async () => snapshot}
        repositoryScope="other/ci-frontend"
        storageNamespace="controlled-scope"
      />,
    )

    expect(await screen.findByText('No repositories found.')).toBeInTheDocument()
  })
})
