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

interface Persisted {
  search?: string
  visibility?: Visibility[]
  ciStatus?: CiStatus[]
  hasOpenPrs?: boolean
}

function load(key: string): RepoFilters {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyFilters()
    const p = JSON.parse(raw) as Persisted
    return {
      search: typeof p.search === 'string' ? p.search : '',
      visibility: new Set(Array.isArray(p.visibility) ? p.visibility : []),
      ciStatus: new Set(Array.isArray(p.ciStatus) ? p.ciStatus : []),
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
