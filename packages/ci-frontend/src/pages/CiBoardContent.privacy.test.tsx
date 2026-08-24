// src/pages/CiBoardContent.privacy.test.tsx
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot } from '../api/types'
import { CiAdminProvider } from '../CiAdminContext'
import { CiConfigProvider } from '../CiConfigContext'
import * as snapshotHook from '../hooks/useDashboardSnapshot'
import { CiBoardContent } from './CiBoardContent'

// Belt-and-suspenders confidentiality filter at CiBoardContent.tsx:129 — repos.filter(r
// => !r.private) for a non-admin viewer. The server is the primary enforcement point;
// this is the client-side backstop, and it was previously untested (CIF-H1).
const snapshot: DashboardSnapshot = {
  refreshedAt: '2026-07-16T10:00:00Z',
  org: 'FixPortal',
  repositories: [
    { name: 'public-repo', htmlUrl: '', private: false, workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [] },
    { name: 'secret-repo', htmlUrl: '', private: true, workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [] },
  ],
  summary: [],
  lastMergedPr: null,
}

function renderContent(isAdmin: boolean) {
  vi.spyOn(snapshotHook, 'useDashboardSnapshot').mockReturnValue({
    data: snapshot,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof snapshotHook.useDashboardSnapshot>)
  // usePrMerge (hoisted to the page) needs a QueryClient even with the snapshot
  // hook mocked out.
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CiConfigProvider value={{ apiBase: '' }}>
        <CiAdminProvider value={isAdmin}>
          <CiBoardContent />
        </CiAdminProvider>
      </CiConfigProvider>
    </QueryClientProvider>,
  )
}

describe('CiBoardContent private-repo confidentiality filter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('hides a private repo from a non-admin viewer', () => {
    renderContent(false)
    expect(screen.getByText('public-repo')).toBeInTheDocument()
    expect(screen.queryByText('secret-repo')).not.toBeInTheDocument()
  })

  it('shows the private repo to an admin viewer', () => {
    renderContent(true)
    expect(screen.getByText('public-repo')).toBeInTheDocument()
    expect(screen.getByText('secret-repo')).toBeInTheDocument()
  })
})
