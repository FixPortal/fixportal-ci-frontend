import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CiBoard } from './CiBoard'
import type { DashboardSnapshot, MergedPr } from './api/types'

const snapshot: DashboardSnapshot = {
  refreshedAt: '2026-06-22T10:00:00Z',
  org: 'FixPortal',
  repositories: [
    {
      name: 'host-owned',
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

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('renders the actual HTTP 204 response as waiting for the first refresh', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetcher)
  render(
    <CiBoard
      adminSignal={false}
      apiBase="https://empty.example"
      storageNamespace="historical-empty"
    />,
  )

  expect(await screen.findByText('Waiting for the first refresh…')).toBeInTheDocument()
  expect(screen.queryByText(/Dashboard unavailable/)).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('uses the visible aggregate merge ahead of a repository fallback', async () => {
  const aggregate: MergedPr = {
    number: 7,
    title: 'Aggregate merge',
    author: 'alice',
    repo: 'host-owned',
    htmlUrl: 'https://github.com/FixPortal/host-owned/pull/7',
    mergedAt: '2026-06-22T08:00:00Z',
  }
  const value: DashboardSnapshot = {
    ...snapshot,
    lastMergedPr: aggregate,
    repositories: [
      {
        ...snapshot.repositories[0]!,
        lastMergedPr: {
          ...aggregate,
          number: 8,
          title: 'Repository fallback',
          mergedAt: '2026-06-22T09:00:00Z',
        },
      },
    ],
  }
  render(
    <CiBoard
      adminSignal={false}
      snapshotFetcher={async () => value}
      storageNamespace="historical-merge"
    />,
  )

  expect(await screen.findByText('Aggregate merge')).toBeInTheDocument()
  expect(screen.queryByText('Repository fallback')).not.toBeInTheDocument()
})

it('ignores a persisted private-only visibility filter for a guest', async () => {
  localStorage.setItem(
    'ci-dashboard:repo-filters:historical-visibility',
    JSON.stringify({ visibility: ['private'] }),
  )
  render(
    <CiBoard
      adminSignal={false}
      snapshotFetcher={async () => snapshot}
      storageNamespace="historical-visibility"
    />,
  )

  expect(await screen.findByText('host-owned')).toBeInTheDocument()
  expect(screen.queryByText(/No repositories match/)).not.toBeInTheDocument()
})

it.each([false, true])(
  'distinguishes no repositories from hidden No-CI repositories (%s)',
  async (hidden) => {
    if (hidden) localStorage.setItem('ci-dashboard:hide-no-ci:historical-no-ci', 'true')
    const value = hidden ? snapshot : { ...snapshot, repositories: [] }
    render(
      <CiBoard
        adminSignal={false}
        snapshotFetcher={async () => value}
        storageNamespace="historical-no-ci"
      />,
    )

    expect(
      await screen.findByText(
        hidden ? 'All repositories are No-CI — hidden.' : 'No repositories found.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  },
)

it('falls back from an invalid saved theme without changing the host document theme', async () => {
  localStorage.setItem('ci:theme:historical-theme', 'invalid-theme')
  const original = document.documentElement.getAttribute('data-theme')
  document.documentElement.setAttribute('data-theme', 'host-theme')
  const board = render(
    <CiBoard
      adminSignal={false}
      snapshotFetcher={async () => snapshot}
      storageNamespace="historical-theme"
    />,
  )
  try {
    expect(await screen.findByRole('combobox', { name: 'Select theme' })).toHaveValue('system')
    expect(board.container.querySelector('.ci-page')).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'host-theme')
  } finally {
    board.unmount()
    if (original === null) document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', original)
  }
})

it('uses a fresh snapshot already stored in the ambient host QueryClient', () => {
  const fetcher = vi.fn(() => new Promise<Response>(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const client = new QueryClient()
  client.setQueryData(
    ['dashboard-snapshot', 'https://host.example/api/dashboard/snapshot'],
    snapshot,
  )
  const board = render(
    <QueryClientProvider client={client}>
      <CiBoard
        adminSignal={false}
        apiBase="https://host.example"
        storageNamespace="historical-cache"
      />
    </QueryClientProvider>,
  )
  try {
    expect(screen.getByText('host-owned')).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  } finally {
    board.unmount()
    client.clear()
  }
})
