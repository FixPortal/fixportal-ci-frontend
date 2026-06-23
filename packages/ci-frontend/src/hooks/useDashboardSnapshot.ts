import { useQuery } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'
import { useCiAdmin } from '../CiAdminContext'
import type { DashboardSnapshot } from '../api/types'

export function useDashboardSnapshot() {
  const { apiBase, snapshotFetcher, snapshotCacheKey, adminSnapshotUrl, adminSnapshotFetcher, adminSnapshotCacheKey } = useCiConfig()
  const isAdmin = useCiAdmin()

  const queryKeyPrefix = 'dashboard-snapshot'
  let queryKey: unknown[]
  let queryFn: () => Promise<DashboardSnapshot | null>

  // The QueryClient is shared with the host app, so custom-fetcher branches must
  // not alias on a fixed sentinel — fold in the caller's cache key to keep
  // distinct boards/sources (or a swapped fetcher) on separate cache rows.
  // .filter(Boolean) drops the trailing segment when no cache key was supplied.
  if (isAdmin && adminSnapshotFetcher) {
    queryKey = [queryKeyPrefix, '__admin_fetcher__', adminSnapshotCacheKey].filter(Boolean)
    queryFn = adminSnapshotFetcher
  } else if (isAdmin && adminSnapshotUrl) {
    queryKey = [queryKeyPrefix, adminSnapshotUrl]
    queryFn = () => getDashboardSnapshot(adminSnapshotUrl)
  } else if (isAdmin && snapshotFetcher) {
    // A2: an admin who supplied only the shared snapshotFetcher (no admin-specific
    // one) still uses it — and so still sends auth headers — rather than falling
    // through to an unauthenticated fetch. Namespaced apart from the guest path.
    queryKey = [queryKeyPrefix, '__guest_fetcher__', 'admin-fallback', snapshotCacheKey].filter(Boolean)
    queryFn = snapshotFetcher
  } else if (!isAdmin && snapshotFetcher) {
    queryKey = [queryKeyPrefix, '__guest_fetcher__', snapshotCacheKey].filter(Boolean)
    queryFn = snapshotFetcher
  } else {
    const snapshotUrl = `${apiBase.replace(/\/$/, '')}/api/dashboard/snapshot`
    queryKey = [queryKeyPrefix, snapshotUrl]
    queryFn = () => getDashboardSnapshot(snapshotUrl)
  }
  return useQuery({
    queryKey,
    queryFn,
    refetchInterval: 60_000,
    // Keep polling while the tab is backgrounded so returning to it shows fresh
    // data, not a snapshot frozen at blur. staleTime gates focus refetches: a
    // return within 30s reuses cache, a later one refetches. Structural sharing
    // (react-query default) means a no-change tick skips the memoised-board
    // re-render, so focus refetch is cheap. Set per-query (not on the shared app
    // QueryClient) so the host app is unaffected.
    refetchIntervalInBackground: true,
    staleTime: 30_000,
  })
}
