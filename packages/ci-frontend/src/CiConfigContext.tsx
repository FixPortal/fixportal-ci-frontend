import { createContext, use } from 'react'

// Runtime config for the CI board. apiBase is the origin of the CI backend
// snapshot API (no trailing slash). Injected by the host so the library carries
// no build-time env assumption; falls back to the public default.
export interface CiConfig {
  apiBase: string
}

export const DEFAULT_CI_API_BASE = 'https://ci.fixportal.org'

const CiConfigContext = createContext<CiConfig>({ apiBase: DEFAULT_CI_API_BASE })
CiConfigContext.displayName = 'CiConfigContext'

export const CiConfigProvider = CiConfigContext.Provider

export function useCiConfig(): CiConfig {
  return use(CiConfigContext)
}
