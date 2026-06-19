import { describe, it, expect } from 'vitest'
import { flattenOpenPrs } from './flattenOpenPrs'
import type { RepositorySnapshot } from '../api/types'

function repo(name: string, prs: { number: number; createdAt: string }[]): RepositorySnapshot {
  return {
    name, htmlUrl: '', private: true, workflows: [], metrics: null, deploys: [], packages: [],
    pullRequests: prs.map(p => ({
      number: p.number, title: `pr ${p.number}`, author: 'u',
      htmlUrl: `u/${p.number}`, isDraft: false, createdAt: p.createdAt,
    })),
  }
}

describe('flattenOpenPrs', () => {
  it('flattens across repos with repo name, oldest-first', () => {
    const repos = [
      repo('a', [{ number: 2, createdAt: '2026-05-20T00:00:00Z' }]),
      repo('b', [{ number: 1, createdAt: '2026-05-10T00:00:00Z' }]),
    ]
    const flat = flattenOpenPrs(repos)
    expect(flat.map(p => `${p.repo}#${p.number}`)).toEqual(['b#1', 'a#2'])
  })
  it('returns an empty array when there are no open PRs', () => {
    expect(flattenOpenPrs([repo('a', [])])).toEqual([])
  })
})
