// src/pages/CiBoardContent.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import type { DashboardSnapshot } from '../api/types'
import { CiBoard } from '../CiBoard'

const snapshot: DashboardSnapshot = {
  refreshedAt: '2026-06-22T10:00:00Z',
  org: 'FixPortal',
  repositories: [
    { name: 'engine', htmlUrl: '', private: false, workflows: [{ name: 'ci', file: 'ci.yml', state: 'failure', lastRun: null }], pullRequests: [], metrics: null, deploys: [], packages: [] },
    { name: 'portal', htmlUrl: '', private: false, workflows: [{ name: 'ci', file: 'ci.yml', state: 'success', lastRun: null }], pullRequests: [], metrics: null, deploys: [], packages: [] },
  ],
  summary: [],
  lastMergedPr: null,
}

function renderBoard() {
  render(
    <CiBoard
      adminSignal={true}
      snapshotFetcher={async () => snapshot}
      adminSnapshotFetcher={async () => snapshot}
      storageNamespace="test"
    />,
  )
}

describe('CiBoardContent filtering', () => {
  beforeEach(() => localStorage.clear())

  it('shows the filtered empty state with a Clear filters action when nothing matches', async () => {
    renderBoard()
    expect(await screen.findByText('engine')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'zzz-no-match')
    expect(await screen.findByText(/no repositories match the active filters/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(await screen.findByText('engine')).toBeInTheDocument()
  })

  it('narrows the board when a CI-status chip is selected', async () => {
    renderBoard()
    expect(await screen.findByText('portal')).toBeInTheDocument()
    const bar = screen.getByRole('search')
    await userEvent.click(within(bar).getByRole('button', { name: /failing/i }))
    expect(screen.queryByText('portal')).not.toBeInTheDocument()
    expect(screen.getByText('engine')).toBeInTheDocument()
  })
})
