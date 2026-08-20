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
