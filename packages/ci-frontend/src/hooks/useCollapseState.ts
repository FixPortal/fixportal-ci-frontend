import { useCallback, useEffect, useState } from 'react'
import { useCiConfig } from '../CiConfigContext'

const DEFAULT_KEY = 'ci-dashboard:collapsed'

function load(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function save(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // ignore (private mode / quota) — collapse state is best-effort
  }
}

// A repo absent from the set is expanded, so new repos default to expanded.
export function useCollapseState() {
  const { storageNamespace } = useCiConfig()
  const key = storageNamespace ? `${DEFAULT_KEY}:${storageNamespace}` : DEFAULT_KEY
  const [collapsed, setCollapsed] = useState<Set<string>>(() => load(key))

  useEffect(() => {
    save(key, collapsed)
  }, [key, collapsed])

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
