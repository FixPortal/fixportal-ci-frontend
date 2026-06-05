import { afterEach, expect, test, vi } from 'vitest'
import { getDashboardSnapshot } from './getDashboardSnapshot'

afterEach(() => vi.unstubAllGlobals())

test('fetches the snapshot from the supplied CI API base and returns it', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ refreshedAt: '2026-05-31T00:00:00Z', org: 'FixPortal', repositories: [], summary: [], lastMergedPr: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const snapshot = await getDashboardSnapshot('https://ci.test')

  expect(fetchMock).toHaveBeenCalledWith('https://ci.test/api/dashboard/snapshot')
  expect(snapshot).toMatchObject({ org: 'FixPortal', repositories: [] })
})

test('trims a trailing slash on the base so the path never doubles up', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)

  await getDashboardSnapshot('https://ci.test/')

  expect(fetchMock).toHaveBeenCalledWith('https://ci.test/api/dashboard/snapshot')
})

test('returns null on 204 (no snapshot yet)', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  await expect(getDashboardSnapshot('https://ci.test')).resolves.toBeNull()
})

test('throws on a non-ok, non-204 response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })))
  await expect(getDashboardSnapshot('https://ci.test')).rejects.toThrow(/502/)
})
