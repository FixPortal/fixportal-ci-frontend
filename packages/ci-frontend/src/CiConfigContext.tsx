import { createContext, use } from 'react'

// Runtime config for the CI board. apiBase is the origin of the CI backend
// snapshot API (no trailing slash). Empty string means relative URLs — works
// with any nginx proxy (Docker Compose or www.fixportal.org/ci).
export interface CiConfig {
  apiBase: string
}

export const DEFAULT_CI_API_BASE = ''

const CiConfigContext = createContext<CiConfig>({ apiBase: DEFAULT_CI_API_BASE })
CiConfigContext.displayName = 'CiConfigContext'

export const CiConfigProvider = CiConfigContext.Provider

export function useCiConfig(): CiConfig {
  return use(CiConfigContext)
}
