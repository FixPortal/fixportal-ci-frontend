import { useCallback, useEffect, useState } from 'react'

const KEY = 'ci-dashboard:hide-no-ci'

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

// A single persisted boolean: whether No-CI repos are hidden from the board.
// Default false (shown). Mirrors useCollapseState's best-effort persistence.
export function useHideNoCi() {
  const [hidden, setHidden] = useState<boolean>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(hidden))
    } catch {
      // ignore (private mode / quota) — hide state is best-effort
    }
  }, [hidden])

  const toggle = useCallback(() => {
    setHidden(prev => !prev)
  }, [])

  return { hidden, toggle }
}
