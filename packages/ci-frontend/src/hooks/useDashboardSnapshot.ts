import { useQuery } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'
import { useCiAdmin } from '../CiAdminContext'

export function useDashboardSnapshot() {
  const { apiBase, adminSnapshotUrl } = useCiConfig()
  const isAdmin = useCiAdmin()
  // Admin viewers use the host-proxied admin URL so the shared key stays
  // server-side. Fall back to the public endpoint for non-admin or when no
  // admin URL was wired up by the host.
  const snapshotUrl = isAdmin && adminSnapshotUrl
    ? adminSnapshotUrl
    : `${apiBase.replace(/\/$/, '')}/api/dashboard/snapshot`
  return useQuery({
    queryKey: ['dashboard-snapshot', snapshotUrl],
    queryFn: () => getDashboardSnapshot(snapshotUrl),
    refetchInterval: 60_000,
    // The 60s poll already drives freshness; without these, an incidental tab
    // focus refetches and re-renders the whole board between ticks. Set per-query
    // (not on the shared app QueryClient) so the host app is unaffected;
    // structural sharing then lets the memoised boards skip a no-change tick.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
