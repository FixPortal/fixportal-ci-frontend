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
}

// Fresh, independent Sets on every call. Never expose a shared singleton — a
// mutable default would leak state across hook instances and tests.
export function emptyFilters(): RepoFilters {
  return { search: '', visibility: new Set(), ciStatus: new Set(), hasOpenPrs: false }
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

// Pure, total filter over a repo list. Across groups: AND. Within a group: OR.
// Empty group = no constraint.
export function applyRepoFilters(
  repos: RepositorySnapshot[],
  filters: RepoFilters,
): RepositorySnapshot[] {
  const query = filters.search.trim().toLowerCase()
  return repos.filter(repo => {
    if (query && !repo.name.toLowerCase().includes(query)) return false
    if (filters.visibility.size > 0) {
      const v: Visibility = repo.private ? 'private' : 'public'
      if (!filters.visibility.has(v)) return false
    }
    if (filters.ciStatus.size > 0) {
      const bucket = ciStatusOf(repo)
      if (bucket === null || !filters.ciStatus.has(bucket)) return false
    }
    if (filters.hasOpenPrs && (repo.pullRequests?.length ?? 0) === 0) return false
    return true
  })
}
