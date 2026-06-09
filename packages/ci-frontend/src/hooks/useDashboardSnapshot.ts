import { useQuery } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'
import { useCiAdmin } from '../CiAdminContext'
import type { DashboardSnapshot } from '../api/types'

export function useDashboardSnapshot() {
  const { apiBase, snapshotFetcher, adminSnapshotUrl, adminSnapshotFetcher } = useCiConfig()
  const isAdmin = useCiAdmin()
  // Admin viewers with a host-provided fetcher use it directly. Guest viewers
  // with a host-provided fetcher (e.g. one that attaches a Bearer token) use
  // that. Fall back to plain URL fetch for either role when no fetcher is wired.
  const shouldUseAdminFetcher = isAdmin && !!adminSnapshotFetcher
  const shouldUseGuestFetcher = !isAdmin && !!snapshotFetcher
  const snapshotUrl = isAdmin && adminSnapshotUrl
    ? adminSnapshotUrl
    : `${apiBase.replace(/\/$/, '')}/api/dashboard/snapshot`
  const queryKeyPrefix = 'dashboard-snapshot'
  let queryKey: unknown[]
  let queryFn: () => Promise<DashboardSnapshot | null>

  if (shouldUseAdminFetcher) {
    queryKey = [queryKeyPrefix, '__admin_fetcher__']
    queryFn = adminSnapshotFetcher!
  } else if (shouldUseGuestFetcher) {
    queryKey = [queryKeyPrefix, '__guest_fetcher__']
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
