import { afterEach, expect, test, vi } from 'vitest'
import { getDashboardSnapshot } from './getDashboardSnapshot'

afterEach(() => vi.unstubAllGlobals())

const URL = 'https://ci.test/api/dashboard/snapshot'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('fetches the snapshot from the supplied CI API base and returns it', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ refreshedAt: '2026-05-31T00:00:00Z', org: 'FixPortal', repositories: [], summary: [], lastMergedPr: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const snapshot = await getDashboardSnapshot('https://ci.test/api/dashboard/snapshot')

  // fetch is called with an options object carrying React Query's abort signal
  // (undefined here — no signal passed in this direct call).
  expect(fetchMock).toHaveBeenCalledWith('https://ci.test/api/dashboard/snapshot', { signal: undefined })
  expect(snapshot).toMatchObject({ org: 'FixPortal', repositories: [] })
})

test('returns null on 204 (no snapshot yet)', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  await expect(getDashboardSnapshot('https://ci.test/api/dashboard/snapshot')).resolves.toBeNull()
})

test('throws on a non-ok, non-204 response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })))
  await expect(getDashboardSnapshot('https://ci.test/api/dashboard/snapshot')).rejects.toThrow(/502/)
})

test('normalizes malformed successful JSON without disclosing the response payload', async () => {
  const secret = 'dashboard-secret-marker-7b49'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`{\"token\":\"${secret}`, { status: 200 })))

  const error = await getDashboardSnapshot(URL).then(
    () => undefined,
    (reason: unknown) => reason,
  )

  expect(error).toEqual(new Error('Invalid dashboard snapshot response'))
  expect(String(error)).not.toContain(secret)
})

test.each([
  [{ org: 'FixPortal', refreshedAt: '2026-08-14T00:00:00Z', summary: [], lastMergedPr: null }, '$.repositories'],
  [{ org: 'FixPortal', refreshedAt: '2026-08-14T00:00:00Z', repositories: [{ name: 'repo' }], summary: [], lastMergedPr: null }, '$.repositories[0].htmlUrl'],
  [{ org: 'FixPortal', refreshedAt: '2026-08-14T00:00:00Z', repositories: [], summary: [{ key: 'passing', count: '1' }], lastMergedPr: null }, '$.summary[0].count'],
])('rejects incompatible successful JSON at %s', async (body, path) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)))
  await expect(getDashboardSnapshot(URL)).rejects.toThrow(`Invalid dashboard snapshot at ${path}`)
})
