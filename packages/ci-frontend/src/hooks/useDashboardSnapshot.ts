import { useQuery } from '@tanstack/react-query'
import { getDashboardSnapshot } from '../api/getDashboardSnapshot'
import { useCiConfig } from '../CiConfigContext'

export function useDashboardSnapshot() {
  const { apiBase } = useCiConfig()
  return useQuery({
    queryKey: ['dashboard-snapshot', apiBase],
    queryFn: () => getDashboardSnapshot(apiBase),
    refetchInterval: 60_000,
    // The 60s poll already drives freshness; without these, an incidental tab
    // focus refetches and re-renders the whole board between ticks. Set per-query
    // (not on the shared app QueryClient) so the host app is unaffected;
    // structural sharing then lets the memoised boards skip a no-change tick.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
