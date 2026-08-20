import { useCallback, useEffect, useState } from 'react'
import { useCiConfig } from '../CiConfigContext'

const DEFAULT_KEY = 'ci-dashboard:hide-no-ci'

function load(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

// A single persisted boolean: whether No-CI repos are hidden from the board.
// Default false (shown). Mirrors useCollapseState's best-effort persistence.
export function useHideNoCi() {
  const { storageNamespace } = useCiConfig()
  const key = storageNamespace ? `${DEFAULT_KEY}:${storageNamespace}` : DEFAULT_KEY
  const [hidden, setHidden] = useState<boolean>(() => load(key))

  useEffect(() => {
    try {
      localStorage.setItem(key, String(hidden))
    } catch {
      // ignore (private mode / quota) — hide state is best-effort
    }
  }, [key, hidden])

  const toggle = useCallback(() => {
    setHidden(prev => !prev)
  }, [])

  return { hidden, toggle }
}
