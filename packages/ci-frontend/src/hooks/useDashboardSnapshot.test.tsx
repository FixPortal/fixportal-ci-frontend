// src/hooks/useDashboardSnapshot.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CiConfigProvider } from '../CiConfigContext'
import type { CiConfig } from '../CiConfigContext'
import { CiAdminProvider } from '../CiAdminContext'
import { useDashboardSnapshot } from './useDashboardSnapshot'
import type { DashboardSnapshot } from '../api/types'

function snapshotFor(org: string): DashboardSnapshot {
  return { org, refreshedAt: '2026-07-16T10:00:00Z', repositories: [], summary: [], lastMergedPr: null }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function wrapperFor(client: QueryClient, config: CiConfig, isAdmin = false) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <CiConfigProvider value={config}>
        <CiAdminProvider value={isAdmin}>{children}</CiAdminProvider>
      </CiConfigProvider>
    </QueryClientProvider>
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('useDashboardSnapshot cache-key isolation', () => {
  it('keeps two guest boards with distinct fetchers on separate cache rows when neither supplies a cache key', async () => {
    const client = new QueryClient()
    const { result: boardA } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', snapshotFetcher: async () => snapshotFor('org-a') }),
    })
    const { result: boardB } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', snapshotFetcher: async () => snapshotFor('org-b') }),
    })

    await waitFor(() => expect(boardA.current.data).not.toBeUndefined())
    await waitFor(() => expect(boardB.current.data).not.toBeUndefined())

    expect(boardA.current.data?.org).toBe('org-a')
    expect(boardB.current.data?.org).toBe('org-b')
  })

  it('keeps two co-hosted boards with distinct fetchers on separate cache rows under one shared QueryClient', async () => {
    // Both hooks share a single QueryClient (simulating two boards mounted under
    // the same host app), each with its own snapshotFetcher and a distinct
    // snapshotCacheKey — the guard useDashboardSnapshot.ts:19-51 folds in so the
    // two boards' cache rows don't alias.
    const client = new QueryClient()
    const { result: boardA } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', snapshotFetcher: async () => snapshotFor('org-a'), snapshotCacheKey: 'board-a' }),
    })
    const { result: boardB } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', snapshotFetcher: async () => snapshotFor('org-b'), snapshotCacheKey: 'board-b' }),
    })

    await waitFor(() => expect(boardA.current.data).not.toBeUndefined())
    await waitFor(() => expect(boardB.current.data).not.toBeUndefined())

    expect(boardA.current.data?.org).toBe('org-a')
    expect(boardB.current.data?.org).toBe('org-b')
  })
})

describe('useDashboardSnapshot URL branches', () => {
  it('prefers the admin snapshot fetcher when both admin sources are configured', async () => {
    const fetcher = vi.fn().mockResolvedValue(snapshotFor('fetcher'))
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(snapshotFor('url')))
    vi.stubGlobal('fetch', fetchSpy)
    const client = new QueryClient()
    const { result } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(
        client,
        { apiBase: '', adminSnapshotFetcher: fetcher, adminSnapshotUrl: 'https://admin.example/snapshot' },
        true,
      ),
    })

    await waitFor(() => expect(result.current.data).not.toBeUndefined())
    expect(result.current.data?.org).toBe('fetcher')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches adminSnapshotUrl directly when the viewer is admin and no adminSnapshotFetcher is set', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(snapshotFor('admin-org')))
    vi.stubGlobal('fetch', fetchSpy)
    const client = new QueryClient()
    const { result } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', adminSnapshotUrl: 'https://admin.example/snapshot' }, true),
    })

    await waitFor(() => expect(result.current.data).not.toBeUndefined())
    expect(result.current.data?.org).toBe('admin-org')
    expect(fetchSpy).toHaveBeenCalledWith('https://admin.example/snapshot', expect.objectContaining({ signal: expect.anything() }))
  })

  it('falls back to apiBase + /api/dashboard/snapshot (trailing slash stripped) when no fetcher/URL is configured', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(snapshotFor('default-org')))
    vi.stubGlobal('fetch', fetchSpy)
    const client = new QueryClient()
    const { result } = renderHook(() => useDashboardSnapshot(), {
      // Trailing slash on apiBase exercises the .replace(/\/$/, '') strip at
      // useDashboardSnapshot.ts:33 in the same assertion.
      wrapper: wrapperFor(client, { apiBase: 'https://ci.example/' }, false),
    })

    await waitFor(() => expect(result.current.data).not.toBeUndefined())
    expect(result.current.data?.org).toBe('default-org')
    expect(fetchSpy).toHaveBeenCalledWith('https://ci.example/api/dashboard/snapshot', expect.objectContaining({ signal: expect.anything() }))
  })
})

describe('useDashboardSnapshot admin cache-key isolation', () => {
  it('keeps two admin boards with distinct fetchers on separate cache rows when neither supplies a cache key', async () => {
    const client = new QueryClient()
    const { result: boardA } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', adminSnapshotFetcher: async () => snapshotFor('org-a') }, true),
    })
    const { result: boardB } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', adminSnapshotFetcher: async () => snapshotFor('org-b') }, true),
    })

    await waitFor(() => expect(boardA.current.data).not.toBeUndefined())
    await waitFor(() => expect(boardB.current.data).not.toBeUndefined())

    expect(boardA.current.data?.org).toBe('org-a')
    expect(boardB.current.data?.org).toBe('org-b')
  })

  it('keeps two admin boards with distinct fetchers on separate cache rows under one shared QueryClient', async () => {
    const client = new QueryClient()
    const { result: boardA } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', adminSnapshotFetcher: async () => snapshotFor('org-a'), adminSnapshotCacheKey: 'board-a' }, true),
    })
    const { result: boardB } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: '', adminSnapshotFetcher: async () => snapshotFor('org-b'), adminSnapshotCacheKey: 'board-b' }, true),
    })

    await waitFor(() => expect(boardA.current.data).not.toBeUndefined())
    await waitFor(() => expect(boardB.current.data).not.toBeUndefined())

    expect(boardA.current.data?.org).toBe('org-a')
    expect(boardB.current.data?.org).toBe('org-b')
  })
})

describe('useDashboardSnapshot polling', () => {
  afterEach(() => vi.useRealTimers())

  it('refetches on the 30s refetchInterval', async () => {
    vi.useFakeTimers()
    let calls = 0
    const fetchSpy = vi.fn().mockImplementation(async () => {
      calls += 1
      return jsonResponse(snapshotFor(`org-${calls}`))
    })
    vi.stubGlobal('fetch', fetchSpy)
    const client = new QueryClient()
    const { result } = renderHook(() => useDashboardSnapshot(), {
      wrapper: wrapperFor(client, { apiBase: 'https://ci.example' }, false),
    })

    await vi.waitFor(() => expect(result.current.data).not.toBeUndefined())
    expect(calls).toBe(1)

    await vi.advanceTimersByTimeAsync(30_000)
    await vi.waitFor(() => expect(calls).toBe(2))
    expect(result.current.data?.org).toBe('org-2')
  })
})
