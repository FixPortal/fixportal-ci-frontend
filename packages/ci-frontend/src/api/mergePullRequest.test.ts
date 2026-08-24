import { afterEach, expect, test, vi } from 'vitest'
import { mergePullRequest } from './mergePullRequest'

afterEach(() => { vi.unstubAllGlobals() })

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

test('POSTs repo and pullNumber to the merge URL and returns the merge sha', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { merged: true, sha: 'abc123' }))
  vi.stubGlobal('fetch', fetchMock)
  const result = await mergePullRequest('/api/dashboard/merge', 'fixportal-ci-frontend', 42)
  expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/merge', expect.objectContaining({ method: 'POST' }))
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body).toEqual({ repo: 'fixportal-ci-frontend', pullNumber: 42 })
  expect(result).toEqual({ ok: true, sha: 'abc123' })
})

test('maps a 409 (no longer mergeable) to a failure result with the backend message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(409, { error: 'Pull request is not mergeable' })))
  const result = await mergePullRequest('/api/dashboard/merge', 'x', 1)
  expect(result).toEqual({ ok: false, status: 409, message: 'Pull request is not mergeable' })
})

test('maps a 401/403 to a failure result with a generic admin-auth message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, {})))
  const result = await mergePullRequest('/api/dashboard/merge', 'x', 1)
  expect(result).toEqual({ ok: false, status: 403, message: 'Not authorised to merge' })
})

test('maps other non-OK statuses to a failure result with status', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(502, { error: 'GitHub exploded' })))
  const result = await mergePullRequest('/api/dashboard/merge', 'x', 1)
  expect(result).toEqual({ ok: false, status: 502, message: 'GitHub exploded' })
})

test('maps a network error to a failure result with null status', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
  const result = await mergePullRequest('/api/dashboard/merge', 'x', 1)
  expect(result).toEqual({ ok: false, status: null, message: 'Network error' })
})

test('falls back to a generic message when an error body has no error field', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {})))
  const result = await mergePullRequest('/api/dashboard/merge', 'x', 1)
  expect(result).toEqual({ ok: false, status: 500, message: 'Merge failed (500)' })
})
