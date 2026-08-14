import { useQuery } from '@tanstack/react-query'
import type { QueryFunction } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'
import { useCiAdmin } from '../CiAdminContext'
import type { DashboardSnapshot } from '../api/types'

type SnapshotFetcher = () => Promise<DashboardSnapshot | null>

const fetcherIds = new WeakMap<SnapshotFetcher, number>()
let nextFetcherId = 0

function cacheKeyFor(fetcher: SnapshotFetcher, cacheKey?: string) {
  if (cacheKey !== undefined) return cacheKey

  let id = fetcherIds.get(fetcher)
  if (id === undefined) {
    id = nextFetcherId
    nextFetcherId += 1
    fetcherIds.set(fetcher, id)
  }
  return id
}

export function useDashboardSnapshot() {
  const { apiBase, snapshotFetcher, snapshotCacheKey, adminSnapshotUrl, adminSnapshotFetcher, adminSnapshotCacheKey } = useCiConfig()
  const isAdmin = useCiAdmin()

  const queryKeyPrefix = 'dashboard-snapshot'
  let queryKey: unknown[]
  // QueryFunction (not a bare () => Promise) so the internal fetch branches can
  // accept React Query's { signal } and abort superseded requests; host-supplied
  // custom fetchers stay zero-arg and are still assignable to this type.
  let queryFn: QueryFunction<DashboardSnapshot | null>

  // The QueryClient is shared with the host app, so custom-fetcher branches must
  // not alias on a fixed sentinel — explicit cache keys win; otherwise each
  // fetcher function receives a stable module-local identity.
  if (isAdmin && adminSnapshotFetcher) {
    queryKey = [queryKeyPrefix, '__admin_fetcher__', cacheKeyFor(adminSnapshotFetcher, adminSnapshotCacheKey)]
    queryFn = adminSnapshotFetcher
  } else if (isAdmin && adminSnapshotUrl) {
    queryKey = [queryKeyPrefix, adminSnapshotUrl]
    queryFn = ({ signal }) => getDashboardSnapshot(adminSnapshotUrl, signal)
  } else if (!isAdmin && snapshotFetcher) {
    queryKey = [queryKeyPrefix, '__guest_fetcher__', cacheKeyFor(snapshotFetcher, snapshotCacheKey)]
    queryFn = snapshotFetcher
  } else {
    const snapshotUrl = `${apiBase.replace(/\/$/, '')}/api/dashboard/snapshot`
    queryKey = [queryKeyPrefix, snapshotUrl]
    queryFn = ({ signal }) => getDashboardSnapshot(snapshotUrl, signal)
  }
  return useQuery({
    queryKey,
    queryFn,
    // Backend regenerates the snapshot ~every 60s, so poll at 30s to halve the
    // worst-case tail between a backend refresh and the board reflecting it
    // (a new PR was taking up to ~2min: ~60s backend + ~60s frontend).
    refetchInterval: 30_000,
    // Keep polling while the tab is backgrounded so returning to it shows fresh
    // data, not a snapshot frozen at blur. staleTime gates focus refetches: a
    // return within 15s reuses cache, a later one refetches. Structural sharing
    // (react-query default) means a no-change tick skips the memoised-board
    // re-render, so focus refetch is cheap. Set per-query (not on the shared app
    // QueryClient) so the host app is unaffected.
    refetchIntervalInBackground: true,
    staleTime: 15_000,
  })
}
