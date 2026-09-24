import { expect, test } from 'vitest'
import { parseDashboardSnapshot } from './parseDashboardSnapshot'

const snapshot = {
  refreshedAt: '2026-08-14T00:00:00Z',
  org: 'FixPortal',
  repositories: [{
    name: 'repo',
    htmlUrl: 'https://github.com/FixPortal/repo',
    private: true,
    workflows: [{
      name: 'CI',
      file: 'ci.yml',
      state: 'success',
      lastRun: {
        status: null,
        conclusion: 'success',
        htmlUrl: 'https://github.com/FixPortal/repo/actions/runs/1',
        title: 'CI',
        runNumber: 1,
        branch: null,
        event: 'push',
        updatedAt: '2026-08-14T00:00:00Z',
        repository: null,
        workflowFile: 'ci.yml',
      },
    }],
    pullRequests: [{
      number: 2,
      title: 'Improve CI',
      author: 'chris',
      htmlUrl: 'https://github.com/FixPortal/repo/pull/2',
      isDraft: false,
      createdAt: '2026-08-13T00:00:00Z',
      reviewSignals: [{ name: 'Gitar', state: 'outstanding', count: null, htmlUrl: 'https://gitar.test/review/2' }],
      readyToMerge: null,
    }],
    metrics: { nloc: 1, avgComplexity: 2, functionCount: 3, highComplexityCount: 4, computedAt: '2026-08-14T00:00:00Z' },
    deploys: [{ workflow: 'Deploy', name: 'production', state: 'running', htmlUrl: 'https://github.com/FixPortal/repo/actions/runs/2', updatedAt: '2026-08-14T00:00:00Z' }],
    packages: null,
    lastMergedPr: { number: 1, title: 'Previous PR', author: 'chris', repo: 'repo', htmlUrl: 'https://github.com/FixPortal/repo/pull/1', mergedAt: '2026-08-12T00:00:00Z' },
  }],
  summary: [{ key: 'passing', count: 1, unavailable: true }],
  lastMergedPr: { number: 1, title: 'Previous PR', author: 'chris', repo: 'repo', htmlUrl: 'https://github.com/FixPortal/repo/pull/1', mergedAt: '2026-08-12T00:00:00Z' },
  ciTrend: [{ bucketStart: '2026-08-14T00:00:00Z', state: 'passing', isBackfilled: true }],
  publicCiTrend: null,
  extra: 'accepted',
}

test('returns a complete compatible snapshot including null, optional, and unknown fields', () => {
  expect(parseDashboardSnapshot(snapshot)).toBe(snapshot)
})

test('reports the failing path without exposing payload values', () => {
  const malformed = { ...snapshot, org: { value: 'secret-marker' } }

  expect(() => parseDashboardSnapshot(malformed)).toThrow('Invalid dashboard snapshot at $.org')
  expect(() => parseDashboardSnapshot(malformed)).not.toThrow('secret-marker')
})

const invalidSnapshotCases: Array<[
  string,
  (value: typeof snapshot) => void,
  string,
]> = [
  [
    'workflow signal state',
    value => { value.repositories[0].workflows[0].state = 'queued' },
    '$.repositories[0].workflows[0].state',
  ],
  [
    'workflow run number',
    value => { value.repositories[0].workflows[0].lastRun!.runNumber = Number.NaN },
    '$.repositories[0].workflows[0].lastRun.runNumber',
  ],
  [
    'recent workflow run number',
    value => {
      Object.assign(value.repositories[0].workflows[0], {
        recentRuns: [{ ...value.repositories[0].workflows[0].lastRun, runNumber: Number.NaN }],
      })
    },
    '$.repositories[0].workflows[0].recentRuns[0].runNumber',
  ],
  [
    'repository visibility type',
    value => { value.repositories[0].private = 1 as unknown as boolean },
    '$.repositories[0].private',
  ],
  [
    'pull request draft type',
    value => { value.repositories[0].pullRequests[0].isDraft = 0 as unknown as boolean },
    '$.repositories[0].pullRequests[0].isDraft',
  ],
  [
    'review signal state',
    value => { value.repositories[0].pullRequests[0].reviewSignals![0].state = 'commented' },
    '$.repositories[0].pullRequests[0].reviewSignals[0].state',
  ],
  [
    'job signal state',
    value => { value.repositories[0].deploys![0].state = 'queued' },
    '$.repositories[0].deploys[0].state',
  ],
  [
    'metric value',
    value => { value.repositories[0].metrics!.nloc = Number.POSITIVE_INFINITY },
    '$.repositories[0].metrics.nloc',
  ],
  [
    'repository merged-PR field',
    value => { value.repositories[0].lastMergedPr!.repo = 42 as unknown as string },
    '$.repositories[0].lastMergedPr.repo',
  ],
  [
    'trend state',
    value => { value.ciTrend![0].state = 'unknown' },
    '$.ciTrend[0].state',
  ],
  [
    'summary count',
    value => { value.summary[0].count = Number.NaN },
    '$.summary[0].count',
  ],
]

test.each(invalidSnapshotCases)('rejects invalid nested %s', (_name, mutate, path) => {
  const malformed = structuredClone(snapshot)
  mutate(malformed)
  expect(() => parseDashboardSnapshot(malformed)).toThrow(`Invalid dashboard snapshot at ${path}`)
})
