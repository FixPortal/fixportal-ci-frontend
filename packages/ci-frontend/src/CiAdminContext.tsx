import { createContext, useContext } from 'react'

// Whether the current viewer is the signed-in platform admin. Drives private
// repository visibility and admin-only controls; safe links supplied by the
// guest snapshot remain actionable. Defaults to false (anonymous → read-only).
const CiAdminContext = createContext(false)
CiAdminContext.displayName = 'CiAdminContext'

export const CiAdminProvider = CiAdminContext.Provider

export function useCiAdmin(): boolean {
  return useContext(CiAdminContext)
}
