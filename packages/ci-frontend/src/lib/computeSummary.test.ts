import { describe, it, expect } from 'vitest'
import type { RepositorySnapshot } from '../api/types'
import { computeSummary, withNlocAvailability } from './computeSummary'
import type { SummaryCount } from '../api/types'

function repo(over: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  return {
    name: 'r', htmlUrl: '', private: false,
    workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [],
    ...over,
  }
}

function count(summary: ReturnType<typeof computeSummary>, key: string): number | undefined {
  return summary.find(c => c.key === key)?.count
}

describe('computeSummary', () => {
  it('always includes inventory keys even at zero', () => {
    const s = computeSummary([repo()])
    expect(count(s, 'repos')).toBe(1)
    expect(count(s, 'workflows')).toBe(0)
    expect(count(s, 'nloc-fixportal')).toBe(0)
    expect(count(s, 'nloc-quickfixn')).toBe(0)
    expect(count(s, 'deploys')).toBe(0)
    expect(count(s, 'packages')).toBe(0)
  })

  it('counts failing workflows', () => {
    const r = repo({
      workflows: [
        { name: 'ci', file: 'ci.yml', state: 'failure', lastRun: null },
        { name: 'cd', file: 'cd.yml', state: 'success', lastRun: null },
      ],
    })
    const s = computeSummary([r])
    expect(count(s, 'failing')).toBe(1)
    expect(count(s, 'workflows')).toBe(2)
  })

  it('always includes core CI status and open-prs keys even at zero', () => {
    const r = repo({ workflows: [{ name: 'ci', file: 'ci.yml', state: 'success', lastRun: null }] })
    const s = computeSummary([r])
    expect(count(s, 'open-prs')).toBe(0)
    expect(count(s, 'failing')).toBe(0)
    expect(count(s, 'running')).toBe(0)
    expect(count(s, 'no-ci')).toBe(0)
  })

  it('counts open PRs', () => {
    const r = repo({
      pullRequests: [
        { number: 1, title: 'A', author: 'x', htmlUrl: 'u', isDraft: false, createdAt: '2026-01-01T00:00:00Z' },
        { number: 2, title: 'B', author: 'y', htmlUrl: 'u', isDraft: true, createdAt: '2026-01-02T00:00:00Z' },
      ],
    })
    expect(count(computeSummary([r]), 'open-prs')).toBe(2)
  })

  it('sums nloc from metrics, splitting by repository name', () => {
    const r1 = repo({ name: 'fixportal-engine', metrics: { nloc: 1000, avgComplexity: 2, functionCount: 50, highComplexityCount: 0, computedAt: '' } })
    const r2 = repo({ name: 'fixportal-quickfixn', metrics: { nloc: 500, avgComplexity: 1.5, functionCount: 25, highComplexityCount: 1, computedAt: '' } })
    const s = computeSummary([r1, r2])
    expect(count(s, 'nloc-fixportal')).toBe(1000)
    expect(count(s, 'nloc-quickfixn')).toBe(500)
  })

  it('counts no-ci repos', () => {
    const noci = repo({ workflows: [] })
    const hasci = repo({ workflows: [{ name: 'ci', file: 'ci.yml', state: 'success', lastRun: null }] })
    expect(count(computeSummary([noci, hasci]), 'no-ci')).toBe(1)
  })

  it('counts failing deploys and packages', () => {
    const r = repo({
      deploys: [{ workflow: 'cd', name: 'prod', state: 'failure', htmlUrl: 'u', updatedAt: '' }],
      packages: [{ workflow: 'pkg', name: 'npm', state: 'failure', htmlUrl: 'u', updatedAt: '' }],
    })
    const s = computeSummary([r])
    expect(count(s, 'deploys-failing')).toBe(1)
    expect(count(s, 'packages-failing')).toBe(1)
  })

  it('marks an nloc bucket unavailable when every contributing repo lacks metrics', () => {
    // CIF-002: a failed metrics scan must not render as a measured zero.
    const s = computeSummary([repo(), repo({ name: 'fixportal-quickfixn' })])
    expect(s.find(c => c.key === 'nloc-fixportal')?.unavailable).toBe(true)
    expect(s.find(c => c.key === 'nloc-quickfixn')?.unavailable).toBe(true)
  })

  it('keeps an nloc bucket available when any contributing repo has metrics', () => {
    const measured = repo({ metrics: { nloc: 100, avgComplexity: 2, functionCount: 5, highComplexityCount: 0, computedAt: '' } })
    const s = computeSummary([measured, repo()])
    expect(s.find(c => c.key === 'nloc-fixportal')?.unavailable).toBeUndefined()
  })

  it('treats an nloc bucket with no contributing repos as a true zero', () => {
    const measured = repo({ metrics: { nloc: 100, avgComplexity: 2, functionCount: 5, highComplexityCount: 0, computedAt: '' } })
    const s = computeSummary([measured])
    expect(count(s, 'nloc-quickfixn')).toBe(0)
    expect(s.find(c => c.key === 'nloc-quickfixn')?.unavailable).toBeUndefined()
  })
})

describe('withNlocAvailability', () => {
  it('marks nloc tiles on a server-shaped summary without touching other keys', () => {
    const serverSummary: SummaryCount[] = [
      { key: 'repos', count: 1 },
      { key: 'nloc-fixportal', count: 0 },
      { key: 'nloc-quickfixn', count: 0 },
    ]
    const marked = withNlocAvailability(serverSummary, [repo()])
    expect(marked.find(c => c.key === 'nloc-fixportal')?.unavailable).toBe(true)
    expect(marked.find(c => c.key === 'repos')?.unavailable).toBeUndefined()
  })
})
