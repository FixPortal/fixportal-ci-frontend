// src/hooks/useRepoFilters.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { CiConfigProvider } from '../CiConfigContext'
import { useRepoFilters } from './useRepoFilters'

const KEY = 'ci-dashboard:repo-filters'

// Wrap the hook in a CiConfigProvider carrying a storageNamespace so the
// namespaced key path is exercised.
function nsWrapper(namespace: string) {
  return ({ children }: { children: ReactNode }) => (
    <CiConfigProvider value={{ apiBase: '', storageNamespace: namespace }}>
      {children}
    </CiConfigProvider>
  )
}

describe('useRepoFilters', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to empty, inactive filters', () => {
    const { result } = renderHook(() => useRepoFilters())
    expect(result.current.filters.search).toBe('')
    expect(result.current.filters.visibility.size).toBe(0)
    expect(result.current.isActive).toBe(false)
  })

  it('setSearch updates state, marks active, and persists', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.setSearch('engine'))
    expect(result.current.filters.search).toBe('engine')
    expect(result.current.isActive).toBe(true)
    expect(JSON.parse(localStorage.getItem(KEY)!).search).toBe('engine')
  })

  it('toggleVisibility adds then removes a member', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.toggleVisibility('private'))
    expect(result.current.filters.visibility.has('private')).toBe(true)
    act(() => result.current.toggleVisibility('private'))
    expect(result.current.filters.visibility.has('private')).toBe(false)
  })

  it('toggleCiStatus and toggleHasOpenPrs work and set isActive', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.toggleCiStatus('failing'))
    act(() => result.current.toggleHasOpenPrs())
    expect(result.current.filters.ciStatus.has('failing')).toBe(true)
    expect(result.current.filters.hasOpenPrs).toBe(true)
    expect(result.current.isActive).toBe(true)
  })

  it('clear resets every filter to default', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.setSearch('x'))
    act(() => result.current.toggleCiStatus('passing'))
    act(() => result.current.clear())
    expect(result.current.isActive).toBe(false)
    expect(result.current.filters.ciStatus.size).toBe(0)
  })

  it('seeds from existing localStorage (Sets rehydrated from arrays)', () => {
    localStorage.setItem(KEY, JSON.stringify({ search: 'seed', visibility: ['public'], ciStatus: ['failing'], hasOpenPrs: true }))
    const { result } = renderHook(() => useRepoFilters())
    expect(result.current.filters.search).toBe('seed')
    expect(result.current.filters.visibility.has('public')).toBe(true)
    expect(result.current.filters.ciStatus.has('failing')).toBe(true)
    expect(result.current.filters.hasOpenPrs).toBe(true)
  })

  it('falls back to defaults on malformed JSON', () => {
    localStorage.setItem(KEY, '{not json')
    const { result } = renderHook(() => useRepoFilters())
    expect(result.current.isActive).toBe(false)
  })

  it('persists to and seeds from the namespaced key when storageNamespace is set', () => {
    const NS_KEY = `${KEY}:acme`
    localStorage.setItem(NS_KEY, JSON.stringify({ search: 'ns-seed', visibility: ['private'], ciStatus: [], hasOpenPrs: false }))
    const { result } = renderHook(() => useRepoFilters(), { wrapper: nsWrapper('acme') })
    // Seeds from the namespaced key, not the bare default key.
    expect(result.current.filters.search).toBe('ns-seed')
    expect(result.current.filters.visibility.has('private')).toBe(true)
    // Writes back under the namespaced key.
    act(() => result.current.setSearch('changed'))
    expect(JSON.parse(localStorage.getItem(NS_KEY)!).search).toBe('changed')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('drops unknown members from persisted Sets (untrusted localStorage)', () => {
    localStorage.setItem(KEY, JSON.stringify({
      search: '', visibility: ['public', 'bogus'], ciStatus: ['failing', 'garbage', 42], hasOpenPrs: false,
    }))
    const { result } = renderHook(() => useRepoFilters())
    expect([...result.current.filters.visibility]).toEqual(['public'])
    expect([...result.current.filters.ciStatus]).toEqual(['failing'])
  })
})
