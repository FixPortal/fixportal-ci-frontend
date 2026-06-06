import { useCallback, useEffect, useState } from 'react'

const KEY = 'ci-dashboard:collapsed'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function save(set: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch {
    // ignore (private mode / quota) — collapse state is best-effort
  }
}

// A repo absent from the set is expanded, so new repos default to expanded.
export function useCollapseState() {
  const [collapsed, setCollapsed] = useState<Set<string>>(load)

  useEffect(() => {
    save(collapsed)
  }, [collapsed])

  const mutate = useCallback((fn: (next: Set<string>) => void) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      fn(next)
      return next
    })
  }, [])

  return {
    isCollapsed: useCallback((name: string) => collapsed.has(name), [collapsed]),
    allCollapsed: useCallback(
      (names: string[]) => names.length > 0 && names.every(n => collapsed.has(n)),
      [collapsed],
    ),
    toggle: useCallback((name: string) => mutate(s => (s.has(name) ? s.delete(name) : s.add(name))), [mutate]),
    collapseAll: useCallback((names: string[]) => mutate(s => names.forEach(n => s.add(n))), [mutate]),
    expandAll: useCallback(() => mutate(s => s.clear()), [mutate]),
  }
}
