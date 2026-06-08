import { useQuery } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'
import { useCiAdmin } from '../CiAdminContext'

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
  const queryKey = shouldUseAdminFetcher
    ? ['dashboard-snapshot', '__admin_fetcher__']
    : shouldUseGuestFetcher
      ? ['dashboard-snapshot', '__guest_fetcher__']
      : ['dashboard-snapshot', snapshotUrl]
  const queryFn = shouldUseAdminFetcher
    ? adminSnapshotFetcher!
    : shouldUseGuestFetcher
      ? snapshotFetcher!
      : () => getDashboardSnapshot(snapshotUrl)
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
