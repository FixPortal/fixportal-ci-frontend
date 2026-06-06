import { createContext, use } from 'react'
import type { DashboardSnapshot } from './api/types'

// Runtime config for the CI board. apiBase is the origin of the CI backend
// snapshot API (no trailing slash). Empty string means relative URLs — works
// with any nginx proxy (Docker Compose or www.fixportal.org/ci).
// adminSnapshotUrl: when set, the board fetches this URL directly (instead of
// apiBase + /api/dashboard/snapshot) when the viewer is admin. Lets a host
// proxy the admin endpoint server-side without exposing the shared key to the
// browser — the host passes a same-origin relative URL here, and its backend
// adds the X-Admin-Key before forwarding to the CI backend.
// adminSnapshotFetcher: alternative to adminSnapshotUrl for hosts that need to
// attach auth headers (e.g. MSAL Bearer token) to the admin snapshot request.
// Takes precedence over adminSnapshotUrl when both are supplied.
export interface CiConfig {
  apiBase: string
  adminSnapshotUrl?: string
  adminSnapshotFetcher?: () => Promise<DashboardSnapshot | null>
}

export const DEFAULT_CI_API_BASE = ''

const CiConfigContext = createContext<CiConfig>({ apiBase: DEFAULT_CI_API_BASE })
CiConfigContext.displayName = 'CiConfigContext'

export const CiConfigProvider = CiConfigContext.Provider

export function useCiConfig(): CiConfig {
  return use(CiConfigContext)
}
