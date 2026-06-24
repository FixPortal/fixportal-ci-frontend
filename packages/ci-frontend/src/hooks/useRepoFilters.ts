// src/hooks/useRepoFilters.ts
import { useCallback, useEffect, useState } from 'react'
import { useCiConfig } from '../CiConfigContext'
import {
  emptyFilters,
  type CiStatus,
  type RepoFilters,
  type Visibility,
} from '../lib/applyRepoFilters'

const DEFAULT_KEY = 'ci-dashboard:repo-filters'

const VISIBILITIES: readonly Visibility[] = ['public', 'private']
const CI_STATUSES: readonly CiStatus[] = ['failing', 'passing', 'no-ci']

interface Persisted {
  search?: string
  visibility?: unknown
  ciStatus?: unknown
  hasOpenPrs?: boolean
}

// Rehydrate a persisted array as a Set of known members only. localStorage is
// untrusted (hand-edits, version skew), so drop anything outside the enum rather
// than letting an arbitrary string into a Set<Visibility>/Set<CiStatus> — it
// would never match a real bucket but would render a stale chip pressed.
function loadSet<T>(raw: unknown, valid: readonly T[]): Set<T> {
  if (!Array.isArray(raw)) return new Set()
  return new Set(raw.filter((x): x is T => (valid as readonly unknown[]).includes(x)))
}

function load(key: string): RepoFilters {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyFilters()
    const p = JSON.parse(raw) as Persisted
    return {
      search: typeof p.search === 'string' ? p.search : '',
      visibility: loadSet(p.visibility, VISIBILITIES),
      ciStatus: loadSet(p.ciStatus, CI_STATUSES),
      hasOpenPrs: p.hasOpenPrs === true,
    }
  } catch {
    return emptyFilters()
  }
}

function save(key: string, f: RepoFilters) {
  try {
    localStorage.setItem(key, JSON.stringify({
      search: f.search,
      visibility: [...f.visibility],
      ciStatus: [...f.ciStatus],
      hasOpenPrs: f.hasOpenPrs,
    }))
  } catch {
    // ignore (private mode / quota) — filter state is best-effort
  }
}

function toggleIn<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

// Persisted repo-filter state, namespaced per host exactly like useHideNoCi /
// useCollapseState. Sets are serialised as arrays.
export function useRepoFilters() {
  const { storageNamespace } = useCiConfig()
  // storageNamespace must be stable for the component lifetime: the initial state
  // is seeded once from load(key), so a mid-life namespace change would persist the
  // old filters under the new key without re-reading it. Every host sets it once.
  const key = storageNamespace ? `${DEFAULT_KEY}:${storageNamespace}` : DEFAULT_KEY
  const [filters, setFilters] = useState<RepoFilters>(() => load(key))

  useEffect(() => {
    save(key, filters)
  }, [key, filters])

  const setSearch = useCallback((search: string) => setFilters(f => ({ ...f, search })), [])
  const toggleVisibility = useCallback(
    (v: Visibility) => setFilters(f => ({ ...f, visibility: toggleIn(f.visibility, v) })),
    [],
  )
  const toggleCiStatus = useCallback(
    (s: CiStatus) => setFilters(f => ({ ...f, ciStatus: toggleIn(f.ciStatus, s) })),
    [],
  )
  const toggleHasOpenPrs = useCallback(() => setFilters(f => ({ ...f, hasOpenPrs: !f.hasOpenPrs })), [])
  const clear = useCallback(() => setFilters(emptyFilters()), [])

  const isActive = filters.search.trim() !== '' || filters.visibility.size > 0 || filters.ciStatus.size > 0 || filters.hasOpenPrs

  return { filters, setSearch, toggleVisibility, toggleCiStatus, toggleHasOpenPrs, clear, isActive }
}
