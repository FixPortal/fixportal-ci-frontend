import { describe, it, expect } from 'vitest'
import type { RepositorySnapshot } from '../api/types'
import { isNoCi } from './isNoCi'

function repo(workflows: RepositorySnapshot['workflows']): RepositorySnapshot {
  return {
    workflows,
    name: 'r', htmlUrl: '', private: false,
    pullRequests: [], metrics: null, deploys: [], packages: [],
  }
}

describe('isNoCi', () => {
  it('is true when a repo has zero workflows', () => {
    expect(isNoCi(repo([]))).toBe(true)
  })
  it('is false when a repo has at least one workflow', () => {
    expect(isNoCi(repo([{ name: 'ci', file: 'ci.yml', state: 'success', lastRun: null }]))).toBe(false)
  })
  it('is true when workflows is missing entirely (defensive)', () => {
    expect(isNoCi({ name: 'r' } as unknown as RepositorySnapshot)).toBe(true)
  })
})
