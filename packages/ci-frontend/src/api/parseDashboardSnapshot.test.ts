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

// Residual validators (audit U1): one rejecting case per validator, written against
// untyped paths so a deliberately wrong value needs no cast per case.
function setAt(root: unknown, keys: ReadonlyArray<string | number>, value: unknown): void {
  const parent = keys.slice(0, -1).reduce<unknown>((node, key) => (node as Record<string | number, unknown>)[key], root)
  ;(parent as Record<string | number, unknown>)[keys[keys.length - 1]] = value
}

const repo = ['repositories', 0] as const
const run = [...repo, 'workflows', 0, 'lastRun'] as const
const pr = [...repo, 'pullRequests', 0] as const
const signal = [...pr, 'reviewSignals', 0] as const
const validJob = snapshot.repositories[0].deploys[0]
const validMerged = snapshot.lastMergedPr

const residualValidatorCases: Array<[string, ReadonlyArray<string | number>, unknown, string]> = [
  ['recentRuns not an array', [...repo, 'workflows', 0, 'recentRuns'], 'x', '$.repositories[0].workflows[0].recentRuns'],
  ['run repository', [...run, 'repository'], 5, '$.repositories[0].workflows[0].lastRun.repository'],
  ['run workflowFile', [...run, 'workflowFile'], 5, '$.repositories[0].workflows[0].lastRun.workflowFile'],
  ['run providerRunId', [...run, 'providerRunId'], '1', '$.repositories[0].workflows[0].lastRun.providerRunId'],
  ['run runAttempt', [...run, 'runAttempt'], '1', '$.repositories[0].workflows[0].lastRun.runAttempt'],
  ['run headSha', [...run, 'headSha'], 5, '$.repositories[0].workflows[0].lastRun.headSha'],
  ['pull request readyToMerge', [...pr, 'readyToMerge'], 'yes', '$.repositories[0].pullRequests[0].readyToMerge'],
  ['pull request headSha', [...pr, 'headSha'], 5, '$.repositories[0].pullRequests[0].headSha'],
  ['review signals not an array', [...pr, 'reviewSignals'], 'x', '$.repositories[0].pullRequests[0].reviewSignals'],
  ['review signal count', [...signal, 'count'], '3', '$.repositories[0].pullRequests[0].reviewSignals[0].count'],
  ['review signal htmlUrl', [...signal, 'htmlUrl'], 5, '$.repositories[0].pullRequests[0].reviewSignals[0].htmlUrl'],
  ['packages not an array', [...repo, 'packages'], 'x', '$.repositories[0].packages'],
  ['package field', [...repo, 'packages'], [{ ...validJob, name: 5 }], '$.repositories[0].packages[0].name'],
  ['package state', [...repo, 'packages'], [{ ...validJob, state: 'queued' }], '$.repositories[0].packages[0].state'],
  ['repository lastMergedPr', [...repo, 'lastMergedPr'], 'x', '$.repositories[0].lastMergedPr'],
  ['top-level lastMergedPr', ['lastMergedPr'], { ...validMerged, number: '1' }, '$.lastMergedPr.number'],
  ['summary unavailable', ['summary', 0, 'unavailable'], 'yes', '$.summary[0].unavailable'],
  ['ciTrend not an array', ['ciTrend'], 'x', '$.ciTrend'],
  ['publicCiTrend not an array', ['publicCiTrend'], 'x', '$.publicCiTrend'],
  ['ciTrend bucketStart', ['ciTrend', 0, 'bucketStart'], 1, '$.ciTrend[0].bucketStart'],
  ['ciTrend isBackfilled', ['ciTrend', 0, 'isBackfilled'], 'yes', '$.ciTrend[0].isBackfilled'],
  ['publicCiTrend bucketStart', ['publicCiTrend'], [{ bucketStart: 1, state: 'passing' }], '$.publicCiTrend[0].bucketStart'],
  ['publicCiTrend state', ['publicCiTrend'], [{ bucketStart: 'x', state: 'queued' }], '$.publicCiTrend[0].state'],
]

test.each(residualValidatorCases)('rejects invalid %s', (_name, keys, value, path) => {
  const malformed = structuredClone(snapshot)
  setAt(malformed, keys, value)
  expect(() => parseDashboardSnapshot(malformed)).toThrow(`Invalid dashboard snapshot at ${path}`)
})

const legalEnumCases: Array<[string, ReadonlyArray<string | number>, readonly string[]]> = [
  ['workflow state', [...repo, 'workflows', 0, 'state'], ['success', 'failure', 'running', 'unknown']],
  ['job signal state', [...repo, 'deploys', 0, 'state'], ['success', 'failure', 'running', 'unknown']],
  ['review signal state', [...signal, 'state'], ['clean', 'outstanding', 'pending', 'disabled']],
  ['ciTrend state', ['ciTrend', 0, 'state'], ['noData', 'passing', 'failing']],
  ['publicCiTrend state', ['publicCiTrend'], ['noData', 'passing', 'failing']],
]

test.each(legalEnumCases.flatMap(([name, keys, members]) => members.map(member => [name, keys, member] as const)))(
  'accepts legal %s %s',
  (_name, keys, member) => {
    const candidate = structuredClone(snapshot)
    setAt(candidate, keys, keys[0] === 'publicCiTrend' ? [{ bucketStart: 'x', state: member }] : member)
    expect(() => parseDashboardSnapshot(candidate)).not.toThrow()
  },
)
