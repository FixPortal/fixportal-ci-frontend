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

describe('CiBoardContent scope text', () => {
  beforeEach(() => localStorage.clear())

  it('shows static "all repositories" scope when no filters are active', async () => {
    renderBoard()
    expect(await screen.findByText(/all repositories/)).toBeInTheDocument()
  })

  it('shows live count in scope when a filter chip is active', async () => {
    renderBoard()
    expect(await screen.findByText('engine')).toBeInTheDocument()
    const bar = screen.getByRole('search')
    await userEvent.click(within(bar).getByRole('button', { name: /failing/i }))
    expect(await screen.findByText(/1 of 2 repositories/)).toBeInTheDocument()
  })

  it('reverts to static scope when filters are cleared', async () => {
    renderBoard()
    expect(await screen.findByText('engine')).toBeInTheDocument()
    const bar = screen.getByRole('search')
    await userEvent.click(within(bar).getByRole('button', { name: /failing/i }))
    expect(await screen.findByText(/1 of 2 repositories/)).toBeInTheDocument()
    await userEvent.click(within(bar).getByRole('button', { name: /failing/i }))
    expect(await screen.findByText(/all repositories/)).toBeInTheDocument()
  })

  it('shows live count in scope when Hide No-CI is active', async () => {
    const snapshotWithNoCi = {
      ...snapshot,
      repositories: [
        ...snapshot.repositories,
        { name: 'static-site', htmlUrl: '', private: false, workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [] },
      ],
    }
    render(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => snapshotWithNoCi}
        adminSnapshotFetcher={async () => snapshotWithNoCi}
        storageNamespace="test-noci"
      />,
    )
    expect(await screen.findByText('static-site')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /hide no-ci/i }))
    expect(await screen.findByText(/2 of 3 repositories/)).toBeInTheDocument()
  })
})

describe('CiBoardContent controlled repository scope', () => {
  beforeEach(() => localStorage.clear())

  const scopedSnapshot: DashboardSnapshot = {
    ...snapshot,
    summary: [
      { key: 'repos', count: 99 },
      { key: 'failing', count: 88 },
      { key: 'open-prs', count: 77 },
    ],
    lastMergedPr: {
      number: 2,
      title: 'Other merge',
      author: 'chris',
      repo: 'other',
      htmlUrl: 'https://github.com/FixPortal/other/pull/2',
      mergedAt: '2026-06-22T09:00:00Z',
    },
    repositories: [
      {
        name: 'controlled',
        htmlUrl: '',
        private: true,
        workflows: [{ name: 'ci', file: 'ci.yml', state: 'success', lastRun: null }],
        pullRequests: [{ number: 1, title: 'Scoped PR', author: 'chris', htmlUrl: '', isDraft: false, createdAt: '2026-06-22T08:00:00Z' }],
        metrics: null,
        deploys: [],
        packages: [],
      },
      {
        name: 'controlled-extra',
        htmlUrl: '',
        private: false,
        workflows: [{ name: 'ci', file: 'ci.yml', state: 'failure', lastRun: null }],
        pullRequests: [{ number: 2, title: 'Other PR', author: 'chris', htmlUrl: '', isDraft: false, createdAt: '2026-06-22T07:00:00Z' }],
        metrics: null,
        deploys: [],
        packages: [],
      },
    ],
  }

  function renderScopedBoard(repositoryScope?: string) {
    return render(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => scopedSnapshot}
        adminSnapshotFetcher={async () => scopedSnapshot}
        repositoryScope={repositoryScope}
        storageNamespace="controlled-scope-content"
      />,
    )
  }

  it('uses a full case-insensitive owner/repository identity for private repositories', async () => {
    renderScopedBoard('fIxPoRtAl/CoNtRoLlEd')

    expect(await screen.findByText('controlled')).toBeInTheDocument()
    expect(screen.queryByText('controlled-extra')).not.toBeInTheDocument()
    expect(document.querySelector('.dashboard__repo-scope')).toHaveTextContent('FixPortal · 1 of 1 repositories')
  })

  it.each(['other/controlled', 'FixPortal/control', 'FixPortal/controlled-ex'])(
    'rejects non-exact repository scope %s',
    async repositoryScope => {
      renderScopedBoard(repositoryScope)

      expect(await screen.findByText('No repositories found.')).toBeInTheDocument()
    },
  )

  it('derives the summary, descriptor, counters, and stepper from the scoped repository', async () => {
    renderScopedBoard('FixPortal/controlled')

    expect(await screen.findByText('controlled')).toBeInTheDocument()
    expect(document.querySelector('.dashboard__repo-scope')).toHaveTextContent('FixPortal · 1 of 1 repositories')
    expect(document.querySelector('[data-key="repos"]')).toHaveTextContent('1Repositories')
    expect(screen.getByRole('button', { name: '1Open PR' })).toBeInTheDocument()
    expect(screen.getByText('controlled #1')).toBeInTheDocument()
    expect(screen.queryByText('Other merge')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '1Open PR' }))
    expect(await screen.findByRole('dialog', { name: 'Open pull requests' })).toHaveTextContent('controlled')
    expect(screen.getByRole('dialog')).toHaveTextContent('1 / 1')
    expect(screen.queryByText('Other PR')).not.toBeInTheDocument()
  })

  it('keeps the server summary and unfiltered descriptor when no scope is supplied', async () => {
    renderScopedBoard()

    expect(await screen.findByText('controlled-extra')).toBeInTheDocument()
    expect(document.querySelector('[data-key="repos"]')).toHaveTextContent('99Repositories')
    expect(screen.getByText(/all repositories/)).toBeInTheDocument()
  })

  // An empty/whitespace scope matches nothing, which used to blank the board
  // with "No repositories found." It means "no scope" and must behave as such.
  it.each(['', '   '])('treats empty scope %j as no scope', async repositoryScope => {
    renderScopedBoard(repositoryScope)

    expect(await screen.findByText('controlled-extra')).toBeInTheDocument()
    expect(screen.getByText(/all repositories/)).toBeInTheDocument()
  })

  // ciTrend is organisation-wide; a scoped board must not chart out-of-scope
  // activity, so the weather bar is hidden while the scope is set (MED-6).
  it('hides the org-wide CI trend on a scoped board', async () => {
    const trendSnapshot: DashboardSnapshot = {
      ...scopedSnapshot,
      ciTrend: [{ bucketStart: '2026-06-22T09:00:00Z', state: 'passing' }],
    }
    render(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => trendSnapshot}
        adminSnapshotFetcher={async () => trendSnapshot}
        repositoryScope="FixPortal/controlled"
        storageNamespace="controlled-scope-trend"
      />,
    )

    expect(await screen.findByText('controlled')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /CI health/i })).not.toBeInTheDocument()
  })

  it('renders the CI trend on an unscoped board', async () => {
    const trendSnapshot: DashboardSnapshot = {
      ...scopedSnapshot,
      ciTrend: [{ bucketStart: '2026-06-22T09:00:00Z', state: 'passing' }],
    }
    render(
      <CiBoard
        adminSignal={true}
        snapshotFetcher={async () => trendSnapshot}
        adminSnapshotFetcher={async () => trendSnapshot}
        storageNamespace="unscoped-trend"
      />,
    )

    expect(await screen.findByRole('img', { name: /CI health/i })).toBeInTheDocument()
  })
})

describe('CiBoardContent public snapshot fallbacks', () => {
  beforeEach(() => localStorage.clear())

  it('renders the public CI trend when the full trend is unavailable', async () => {
    const publicSnapshot: DashboardSnapshot = {
      ...snapshot,
      summary: [{ key: 'failing', count: 0 }],
      ciTrend: null,
      publicCiTrend: [{ bucketStart: '2026-06-22T09:00:00Z', state: 'passing' }],
    }

    render(<CiBoard adminSignal={false} snapshotFetcher={async () => publicSnapshot} />)

    expect(await screen.findByRole('img', { name: /CI health, last 24h: 0 failing, 1 healthy/i })).toBeInTheDocument()
  })

  it('renders the newest visible repository merge when the aggregate merge is unavailable', async () => {
    const publicSnapshot: DashboardSnapshot = {
      ...snapshot,
      summary: [{ key: 'open-prs', count: 0 }],
      repositories: snapshot.repositories.map((repository, index) => ({
        ...repository,
        lastMergedPr: {
          number: index + 1,
          title: index === 0 ? 'Older merge' : 'Newest merge',
          author: 'chris',
          repo: repository.name,
          htmlUrl: `https://github.com/FixPortal/${repository.name}/pull/${index + 1}`,
          mergedAt: index === 0 ? '2026-06-22T08:00:00Z' : '2026-06-22T09:00:00Z',
        },
      })),
    }

    render(<CiBoard adminSignal={false} snapshotFetcher={async () => publicSnapshot} />)

    expect(await screen.findByText('Newest merge')).toBeInTheDocument()
    expect(screen.queryByText('Older merge')).not.toBeInTheDocument()
  })
})
