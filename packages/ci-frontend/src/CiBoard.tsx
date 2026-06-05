import type { ReactNode } from 'react'
import { CiAdminProvider } from './CiAdminContext'
import { CiConfigProvider, DEFAULT_CI_API_BASE } from './CiConfigContext'
import { CiBoardContent } from './pages/CiBoardContent'
import { DefaultFooter } from './DefaultFooter'

export interface CiBoardProps {
  /** Whether the viewer is an admin: sees private repos + actionable PR links. Host-computed. */
  adminSignal: boolean
  /** Origin of the CI backend snapshot API (no trailing slash). Defaults to the public CI host. */
  apiBase?: string
  /** Brand mark for the header. Defaults to a plain text wordmark. */
  logo?: ReactNode
  /** Footer node. Defaults to a generic, brand-free footer. */
  footerSlot?: ReactNode
}

// The board is style-free at the component level: consumers import the
// stylesheets explicitly -- `@fix-portal/ci-frontend/board.css` (always) and
// optionally `@fix-portal/ci-frontend/tokens.css` if they have no design system
// of their own. This keeps CSS out of the JS bundle and lets a host with its
// own tokens (e.g. the simulator) skip the vendored set.
export function CiBoard({ adminSignal, apiBase = DEFAULT_CI_API_BASE, logo, footerSlot }: CiBoardProps) {
  return (
    <CiConfigProvider value={{ apiBase }}>
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
    </CiConfigProvider>
  )
}
