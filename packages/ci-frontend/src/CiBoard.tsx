import { useState, useContext } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, QueryClientContext } from '@tanstack/react-query'
import { CiAdminProvider } from './CiAdminContext'
import { CiConfigProvider, DEFAULT_CI_API_BASE } from './CiConfigContext'
import { CiBoardContent } from './pages/CiBoardContent'
import { DefaultFooter } from './DefaultFooter'
import type { DashboardSnapshot } from './api/types'

export interface CiBoardProps {
  /** Whether the viewer is an admin: sees private repos + actionable PR links. Host-computed. */
  adminSignal: boolean
  /** Origin of the CI backend snapshot API (no trailing slash). Defaults to '' (relative URLs — requires a same-origin /api/ proxy). Pass 'https://ci.fixportal.org' to reach the public FixPortal backend. */
  apiBase?: string
  /** Fetcher for guest (non-admin) snapshot requests. Use when the public endpoint requires auth headers (e.g. MSAL Bearer token). Falls back to a plain fetch of apiBase + /api/dashboard/snapshot when absent. */
  snapshotFetcher?: () => Promise<DashboardSnapshot | null>
  /** Full URL the board fetches when the viewer is admin. The host's backend should proxy this to the CI backend's /api/dashboard/snapshot/admin endpoint, adding the X-Admin-Key header server-side so the shared secret never reaches the browser. When unset, admin viewers see the public (private-repo-stripped) snapshot. */
  adminSnapshotUrl?: string
  /** Alternative to adminSnapshotUrl for hosts that must attach auth headers (e.g. MSAL Bearer) to the admin snapshot request. Takes precedence over adminSnapshotUrl when both are supplied. */
  adminSnapshotFetcher?: () => Promise<DashboardSnapshot | null>
  /** Brand mark for the header. Defaults to a plain text wordmark. */
  logo?: ReactNode
  /** Footer node. Defaults to a generic, brand-free footer. */
  footerSlot?: ReactNode
}

function QueryClientSafeProvider({ children }: { children: ReactNode }) {
  const existingClient = useContext(QueryClientContext)
  const [localClient] = useState(() => {
    if (!existingClient) {
      return new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
    }
    return null
  })

  if (existingClient) {
    return <>{children}</>
  }

  return (
    <QueryClientProvider client={localClient!}>
      {children}
    </QueryClientProvider>
  )
}

// The board is style-free at the component level: consumers import the
// stylesheets explicitly -- `@fix-portal/ci-frontend/board.css` (always) and
// optionally `@fix-portal/ci-frontend/tokens.css` if they have no design system
// of their own. This keeps CSS out of the JS bundle and lets a host with its
// own tokens (e.g. the simulator) skip the vendored set.
export function CiBoard({ adminSignal, apiBase = DEFAULT_CI_API_BASE, snapshotFetcher, adminSnapshotUrl, adminSnapshotFetcher, logo, footerSlot }: CiBoardProps) {
  return (
    <CiConfigProvider value={{ apiBase, snapshotFetcher, adminSnapshotUrl, adminSnapshotFetcher }}>
      <QueryClientSafeProvider>
        <div className="ci-page">
          <div className="ci-embed">
            <header className="ci-embed__header">
              <span className="ci-embed__lockup">
                {logo ?? <span className="ci-embed__wordmark-text">CI Dashboard</span>}
                <span className="ci-embed__descriptor">
                  CI Dashboard {adminSignal ? '[Admin]' : '[Guest]'}
                </span>
              </span>
            </header>
            <CiAdminProvider value={adminSignal}>
              <CiBoardContent />
            </CiAdminProvider>
          </div>
          {footerSlot ?? <DefaultFooter />}
        </div>
      </QueryClientSafeProvider>
    </CiConfigProvider>
  )
}
