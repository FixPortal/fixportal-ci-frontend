import { useQuery } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'
import { useCiAdmin } from '../CiAdminContext'

export function useDashboardSnapshot() {
  const { apiBase, adminSnapshotUrl, adminSnapshotFetcher } = useCiConfig()
  const isAdmin = useCiAdmin()
  // Admin viewers with a host-provided fetcher (e.g. one that attaches a Bearer
  // token) use it directly. Fall back to the plain URL path, then to the public
  // endpoint for non-admin or when no admin override was wired by the host.
  const useCustomFetcher = isAdmin && !!adminSnapshotFetcher
  const snapshotUrl = isAdmin && adminSnapshotUrl
    ? adminSnapshotUrl
    : `${apiBase.replace(/\/$/, '')}/api/dashboard/snapshot`
  return useQuery({
    queryKey: useCustomFetcher ? ['dashboard-snapshot', '__admin_fetcher__'] : ['dashboard-snapshot', snapshotUrl],
    queryFn: useCustomFetcher ? adminSnapshotFetcher! : () => getDashboardSnapshot(snapshotUrl),
    refetchInterval: 60_000,
    // The 60s poll already drives freshness; without these, an incidental tab
    // focus refetches and re-renders the whole board between ticks. Set per-query
    // (not on the shared app QueryClient) so the host app is unaffected;
    // structural sharing then lets the memoised boards skip a no-change tick.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
