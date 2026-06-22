// src/hooks/useRepoFilters.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRepoFilters } from './useRepoFilters'

const KEY = 'ci-dashboard:repo-filters'

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
})
