import { useQuery } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'
import { useCiAdmin } from '../CiAdminContext'
import type { DashboardSnapshot } from '../api/types'

export function useDashboardSnapshot() {
  const { apiBase, snapshotFetcher, adminSnapshotUrl, adminSnapshotFetcher, snapshotCacheKey } = useCiConfig()
  const isAdmin = useCiAdmin()
  // An admin with an admin-specific fetcher uses it directly. Otherwise any
  // host-provided snapshotFetcher (e.g. one that attaches a Bearer token) is
  // used — including for an admin who supplied only the shared snapshotFetcher,
  // so the admin board still sends auth headers rather than falling through to
  // an unauthenticated fetch. Plain URL fetch only when no fetcher is wired.
  const shouldUseAdminFetcher = isAdmin && !!adminSnapshotFetcher
  const shouldUseSnapshotFetcher = !shouldUseAdminFetcher && !!snapshotFetcher
  const snapshotUrl = isAdmin && adminSnapshotUrl
    ? adminSnapshotUrl
    : `${apiBase.replace(/\/$/, '')}/api/dashboard/snapshot`
  const queryKeyPrefix = 'dashboard-snapshot'
  let queryKey: unknown[]
  let queryFn: () => Promise<DashboardSnapshot | null>

  // The QueryClient is shared with the host app, so custom-fetcher branches must
  // not alias on a fixed sentinel — fold in the caller's snapshotCacheKey to
  // keep distinct boards/sources (or a swapped fetcher) on separate cache rows.
  if (shouldUseAdminFetcher) {
    queryKey = [queryKeyPrefix, '__admin_fetcher__', snapshotCacheKey]
    queryFn = adminSnapshotFetcher!
  } else if (shouldUseSnapshotFetcher) {
    queryKey = [queryKeyPrefix, '__snapshot_fetcher__', snapshotCacheKey]
    queryFn = snapshotFetcher!
  } else {
    queryKey = [queryKeyPrefix, snapshotUrl]
    queryFn = () => getDashboardSnapshot(snapshotUrl)
  }
  return useQuery({
    queryKey,
    queryFn,
    refetchInterval: 60_000,
    // The 60s poll already drives freshness; without these, an incidental tab
    // focus refetches and re-renders the whole board between ticks. Set per-query
    // (not on the shared app QueryClient) so the host app is unaffected;
    // structural sharing then lets the memoised boards skip a no-change tick.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
