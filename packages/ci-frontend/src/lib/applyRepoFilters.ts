// src/lib/applyRepoFilters.ts
import type { RepositorySnapshot } from '../api/types'
import { worstState } from './worstState'
import { isNoCi } from './isNoCi'

export type Visibility = 'public' | 'private'
export type CiStatus = 'failing' | 'passing' | 'no-ci'

// Filter state shape. Each Set empty (or boolean false / empty string) means
// "no constraint": within a group the selected members are ORed, and the groups
// are ANDed together. Sets, not arrays, so membership tests are O(1) and toggles
// are natural.
export interface RepoFilters {
  search: string
  visibility: Set<Visibility>
  ciStatus: Set<CiStatus>
  hasOpenPrs: boolean
  readyToMerge: boolean
}

// Fresh, independent Sets on every call. Never expose a shared singleton — a
// mutable default would leak state across hook instances and tests.
export function emptyFilters(): RepoFilters {
  return {
    search: '',
    visibility: new Set(),
    ciStatus: new Set(),
    hasOpenPrs: false,
    readyToMerge: false,
  }
}

// A repo qualifies when it carries at least one pull request the backend has judged
// ready. Strict `=== true` on purpose: the field is tri-state, and both false ("not
// ready") and null/undefined ("not yet determined", or an older backend that does not
// send it at all) must fail the test rather than be coerced.
export function hasReadyPr(repo: RepositorySnapshot): boolean {
  return (repo.pullRequests ?? []).some(pr => pr.readyToMerge === true)
}

// The CI bucket a repo belongs to, or null when it sits outside all buckets
// (workflows in progress / all-unknown). Mirrors RepoActivityIndicator's read of
// worstState so the filter agrees with the dot shown on each card.
function ciStatusOf(repo: RepositorySnapshot): CiStatus | null {
  if (isNoCi(repo)) return 'no-ci'
  const state = worstState((repo.workflows ?? []).map(w => w.state))
  if (state === 'failure') return 'failing'
  if (state === 'success') return 'passing'
  return null
}

// The search box matches the repo name or any of its open PRs, by number or
// title, so "181" and "decoder" both find the repo carrying that PR. Number
// match is a substring of the decimal number with or without a leading '#'.
function matchesQuery(repo: RepositorySnapshot, query: string): boolean {
  if (repo.name.toLowerCase().includes(query)) return true
  const prQuery = query.startsWith('#') ? query.slice(1) : query
  return (repo.pullRequests ?? []).some(
    pr =>
      pr.title.toLowerCase().includes(query) ||
      (prQuery !== '' && String(pr.number).includes(prQuery)),
  )
}

// Pure, total filter over a repo list. Across groups: AND. Within a group: OR.
// Empty group = no constraint.
export function applyRepoFilters(
  repos: RepositorySnapshot[],
  filters: RepoFilters,
): RepositorySnapshot[] {
  const query = filters.search.trim().toLowerCase()
  return repos.filter(repo => {
    if (query && !matchesQuery(repo, query)) return false
    if (filters.visibility.size > 0) {
      const v: Visibility = repo.private ? 'private' : 'public'
      if (!filters.visibility.has(v)) return false
    }
    if (filters.ciStatus.size > 0) {
      const bucket = ciStatusOf(repo)
      if (bucket === null || !filters.ciStatus.has(bucket)) return false
    }
    if (filters.hasOpenPrs && (repo.pullRequests?.length ?? 0) === 0) return false
    if (filters.readyToMerge && !hasReadyPr(repo)) return false
    return true
  })
}
