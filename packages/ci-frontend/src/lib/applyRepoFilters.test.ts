// src/lib/applyRepoFilters.test.ts
import { describe, it, expect } from 'vitest'
import type { RepositorySnapshot, SignalState } from '../api/types'
import { applyRepoFilters, emptyFilters, type RepoFilters } from './applyRepoFilters'

function repo(over: Partial<RepositorySnapshot>): RepositorySnapshot {
  return {
    name: 'fixportal-docs', htmlUrl: '', private: false,
    workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [],
    ...over,
  }
}
function wf(state: SignalState) {
  return { name: 'ci', file: 'ci.yml', state, lastRun: null }
}
function filters(over: Partial<RepoFilters>): RepoFilters {
  return { ...emptyFilters(), ...over }
}

const failing = repo({ name: 'engine', workflows: [wf('failure')] })
const passing = repo({ name: 'portal', workflows: [wf('success')] })
const running = repo({ name: 'web', workflows: [wf('running')] })
const noCi = repo({ name: 'docs', workflows: [] })
const privatePassing = repo({ name: 'secret', private: true, workflows: [wf('success')] })
const withPr = repo({ name: 'review', workflows: [wf('success')], pullRequests: [
  { number: 181, title: 'FIX Decoder', author: 'a', htmlUrl: '', isDraft: false, createdAt: '2026-01-01' },
] })
const all = [failing, passing, running, noCi, privatePassing, withPr]

function pr(number: number, readyToMerge?: boolean | null) {
  return {
    number,
    title: `PR ${number}`,
    author: 'a',
    htmlUrl: '',
    isDraft: false,
    createdAt: '2026-01-01',
    ...(readyToMerge === undefined ? {} : { readyToMerge }),
  }
}

describe('applyRepoFilters — readyToMerge', () => {
  const ready = repo({ name: 'ready', pullRequests: [pr(1, true)] })
  const notReady = repo({ name: 'not-ready', pullRequests: [pr(2, false)] })
  const undetermined = repo({ name: 'undetermined', pullRequests: [pr(3, null)] })
  // An older backend that does not send the field at all.
  const absent = repo({ name: 'absent', pullRequests: [pr(4)] })
  const mixed = repo({ name: 'mixed', pullRequests: [pr(5, false), pr(6, true)] })
  const noPrs = repo({ name: 'quiet', pullRequests: [] })
  const pool = [ready, notReady, undetermined, absent, mixed, noPrs]

  it('keeps only repos with at least one ready pull request', () => {
    const kept = applyRepoFilters(pool, filters({ readyToMerge: true })).map(r => r.name)
    expect(kept).toEqual(['ready', 'mixed'])
  })

  // The field is tri-state; only an explicit true qualifies. Coercing null or a missing
  // field would surface pull requests nobody has judged.
  it('treats undetermined and absent verdicts as not ready', () => {
    const kept = applyRepoFilters([undetermined, absent], filters({ readyToMerge: true }))
    expect(kept).toEqual([])
  })

  it('is inert when off', () => {
    expect(applyRepoFilters(pool, filters({ readyToMerge: false }))).toHaveLength(pool.length)
  })

  it('ANDs with the other groups rather than replacing them', () => {
    const readyPrivate = repo({ name: 'hidden', private: true, pullRequests: [pr(7, true)] })
    const kept = applyRepoFilters(
      [ready, readyPrivate],
      filters({ readyToMerge: true, visibility: new Set(['private'] as const) }),
    )
    expect(kept.map(r => r.name)).toEqual(['hidden'])
  })
})

describe('applyRepoFilters', () => {
  it('returns the input unchanged when no filters are active', () => {
    expect(applyRepoFilters(all, emptyFilters())).toEqual(all)
  })

  it('matches the search substring case-insensitively against repo name', () => {
    expect(applyRepoFilters(all, filters({ search: 'ENG' })).map(r => r.name)).toEqual(['engine'])
    expect(applyRepoFilters(all, filters({ search: '  ' }))).toEqual(all) // whitespace-only = no filter
  })

  it('matches the search against open PR titles and numbers', () => {
    expect(applyRepoFilters(all, filters({ search: 'decoder' })).map(r => r.name)).toEqual(['review'])
    expect(applyRepoFilters(all, filters({ search: '181' })).map(r => r.name)).toEqual(['review'])
    expect(applyRepoFilters(all, filters({ search: '#181' })).map(r => r.name)).toEqual(['review'])
    expect(applyRepoFilters(all, filters({ search: '#' }))).toEqual([]) // bare # is not "every repo with a PR"
  })

  it('filters by visibility (public only)', () => {
    const out = applyRepoFilters(all, filters({ visibility: new Set(['public']) }))
    expect(out).not.toContain(privatePassing)
    expect(out).toContain(passing)
  })

  it('within the CI-status group, OR across selected buckets', () => {
    const out = applyRepoFilters(all, filters({ ciStatus: new Set(['failing', 'no-ci']) }))
    expect(out.map(r => r.name).sort()).toEqual(['docs', 'engine'])
  })

  it('excludes running / all-unknown repos when any CI-status chip is selected', () => {
    const out = applyRepoFilters(all, filters({ ciStatus: new Set(['passing']) }))
    expect(out).not.toContain(running)
    expect(out.map(r => r.name).sort()).toEqual(['portal', 'review', 'secret'])
  })

  it('hasOpenPrs keeps only repos with >=1 open PR', () => {
    expect(applyRepoFilters(all, filters({ hasOpenPrs: true })).map(r => r.name)).toEqual(['review'])
  })

  it('ANDs across groups', () => {
    const out = applyRepoFilters(all, filters({
      visibility: new Set(['public']),
      ciStatus: new Set(['passing']),
      hasOpenPrs: true,
    }))
    expect(out.map(r => r.name)).toEqual(['review'])
  })

  it('yields an empty list when filters exclude everything', () => {
    expect(applyRepoFilters(all, filters({ ciStatus: new Set(['failing']), hasOpenPrs: true }))).toEqual([])
  })

  it('emptyFilters returns fresh Sets each call (no shared mutable state)', () => {
    const a = emptyFilters()
    const b = emptyFilters()
    a.visibility.add('public')
    expect(b.visibility.has('public')).toBe(false)
  })
})
