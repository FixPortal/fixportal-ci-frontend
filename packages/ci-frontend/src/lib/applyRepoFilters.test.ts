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
  { number: 1, title: 't', author: 'a', htmlUrl: '', isDraft: false, createdAt: '2026-01-01' },
] })
const all = [failing, passing, running, noCi, privatePassing, withPr]

describe('applyRepoFilters', () => {
  it('returns the input unchanged when no filters are active', () => {
    expect(applyRepoFilters(all, emptyFilters())).toEqual(all)
  })

  it('matches the search substring case-insensitively against repo name', () => {
    expect(applyRepoFilters(all, filters({ search: 'ENG' })).map(r => r.name)).toEqual(['engine'])
    expect(applyRepoFilters(all, filters({ search: '  ' }))).toEqual(all) // whitespace-only = no filter
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
