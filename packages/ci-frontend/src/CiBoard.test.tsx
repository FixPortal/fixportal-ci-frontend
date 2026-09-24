import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const readySnapshot: DashboardSnapshot = {
  ...snapshot,
  repositories: [
    {
      ...snapshot.repositories[0],
      pullRequests: [
        {
          number: 42,
          title: 'Ready for release',
          author: 'octocat',
          htmlUrl: 'https://github.com/FixPortal/ci-frontend/pull/42',
          isDraft: false,
          createdAt: '2026-07-16T10:00:00Z',
          readyToMerge: true,
          headSha: 'sha-42',
        },
      ],
    },
  ],
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

  it('uses the host merge fetcher for an admin ready-PR action', async () => {
    const mergeFetcher = vi.fn().mockResolvedValue({ ok: true, sha: 'abc123' })
    render(
      <CiBoard
        adminSignal
        snapshotFetcher={async () => readySnapshot}
        adminSnapshotFetcher={async () => readySnapshot}
        mergeFetcher={mergeFetcher}
        storageNamespace="admin-merge"
      />,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Rebase-merge PR #42' }),
    )

    expect(mergeFetcher).toHaveBeenCalledOnce()
    expect(mergeFetcher).toHaveBeenCalledWith('ci-frontend', 42, 'sha-42')
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

describe('CiBoard snapshot retry integration', () => {
  beforeEach(() => localStorage.clear())

  it('surfaces a persistent fetch failure and recovers through the Retry now action', async () => {
    const snapshotFetcher = vi.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(snapshot)
    render(
      <CiBoard
        adminSignal={false}
        snapshotFetcher={snapshotFetcher}
        storageNamespace="retry-integration"
      />,
    )

    await waitFor(() => expect(screen.getByText(/Dashboard unavailable/)).toBeInTheDocument(), { timeout: 5_000 })
    expect(snapshotFetcher).toHaveBeenCalledTimes(2)

    await userEvent.click(screen.getByRole('button', { name: 'Retry now' }))
    expect(await screen.findByText('ci-frontend')).toBeInTheDocument()
    expect(snapshotFetcher).toHaveBeenCalledTimes(3)
  })
})

describe('CiBoard controlled theme', () => {
  beforeEach(() => localStorage.clear())

  it('applies the host-resolved theme to .ci-page with the switcher suppressed', async () => {
    const { container } = render(
      <CiBoard
        adminSignal={false}
        snapshotFetcher={async () => snapshot}
        showThemeSwitcher={false}
        theme="dark"
        storageNamespace="theme-controlled"
      />,
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'CI Dashboard' })).toBeInTheDocument()
    expect(container.querySelector('.ci-page')).toHaveAttribute('data-theme', 'dark')
    expect(screen.queryByRole('combobox', { name: 'Select theme' })).not.toBeInTheDocument()
  })

  it('follows the host when the theme prop changes', async () => {
    const props = {
      adminSignal: false,
      snapshotFetcher: async () => snapshot,
      storageNamespace: 'theme-rerender',
    }
    const { container, rerender } = render(<CiBoard {...props} theme="light" />)

    expect(container.querySelector('.ci-page')).toHaveAttribute('data-theme', 'light')
    // Controlled means the host owns theme outright: the switcher stays out even
    // when showThemeSwitcher is left at its default.
    expect(screen.queryByRole('combobox', { name: 'Select theme' })).not.toBeInTheDocument()

    rerender(<CiBoard {...props} theme="dark" />)

    expect(container.querySelector('.ci-page')).toHaveAttribute('data-theme', 'dark')
  })

  it('keeps the internal switcher owning data-theme when no theme prop is given', async () => {
    const { container } = render(
      <CiBoard
        adminSignal={false}
        snapshotFetcher={async () => snapshot}
        storageNamespace="theme-uncontrolled"
      />,
    )

    expect(await screen.findByRole('combobox', { name: 'Select theme' })).toBeInTheDocument()
    // The matchMedia stub reports no dark preference, so 'system' resolves light.
    expect(container.querySelector('.ci-page')).toHaveAttribute('data-theme', 'light')
  })

  it('keeps a saved theme when the initial read throws, and persists the next user choice', async () => {
    const key = 'ci:theme:theme-denied'
    localStorage.setItem(key, 'dark')
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage denied') })
    render(
      <CiBoard adminSignal={false} snapshotFetcher={async () => snapshot} storageNamespace="theme-denied" />,
    )
    getItem.mockRestore()

    const select = await screen.findByRole('combobox', { name: 'Select theme' })
    expect(localStorage.getItem(key)).toBe('dark')

    await userEvent.selectOptions(select, 'light')
    expect(localStorage.getItem(key)).toBe('light')
  })
})
