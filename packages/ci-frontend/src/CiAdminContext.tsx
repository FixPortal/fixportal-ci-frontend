import { createContext, use } from 'react'

// Whether the current viewer is the signed-in platform admin. Drives whether PR
// rows render as actionable GitHub links or as plain, non-interactive text.
// Defaults to false (anonymous → read-only).
const CiAdminContext = createContext(false)
CiAdminContext.displayName = 'CiAdminContext'

export const CiAdminProvider = CiAdminContext.Provider

export function useCiAdmin(): boolean {
  return use(CiAdminContext)
}
