import { expect, test } from 'vitest'
import { parseDashboardSnapshot } from './parseDashboardSnapshot'

declare const process: { env: { BACKEND_SNAPSHOT_FIXTURE?: string } }

// @ts-expect-error Node types are deliberately excluded from the browser library build.
const { readFileSync } = await import('node:fs')
const fixture = process.env.BACKEND_SNAPSHOT_FIXTURE

if (!fixture) throw new Error('BACKEND_SNAPSHOT_FIXTURE is required')

test('accepts the backend-owned dashboard snapshot fixture', () => {
  const snapshot = parseDashboardSnapshot(JSON.parse(readFileSync(fixture, 'utf8')) as unknown)
  const pullRequest = snapshot.repositories[0]?.pullRequests[0]

  expect(pullRequest?.reviewSignals).toEqual([
    { name: 'CodeRabbit', state: 'clean', count: 0, htmlUrl: 'https://github.com/FixPortal/public-repo/pull/42#pullrequestreview-1' },
    { name: 'CodeQL', state: 'outstanding', count: 2, htmlUrl: null },
    { name: 'Gitar', state: 'pending', count: null, htmlUrl: null },
    { name: 'Optional', state: 'disabled', count: null, htmlUrl: null },
  ])
  expect(pullRequest?.readyToMerge).toBe(false)
  expect(snapshot.publicCiTrend).toBeNull()
})
