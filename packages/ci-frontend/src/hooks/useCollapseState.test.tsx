import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCollapseState } from './useCollapseState'

describe('useCollapseState', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to expanded (nothing collapsed)', () => {
    const { result } = renderHook(() => useCollapseState())
    expect(result.current.isCollapsed('a')).toBe(false)
    expect(result.current.allCollapsed(['a', 'b'])).toBe(false)
  })

  it('toggles a repo and persists to localStorage', () => {
    const { result } = renderHook(() => useCollapseState())
    act(() => result.current.toggle('a'))
    expect(result.current.isCollapsed('a')).toBe(true)
    expect(localStorage.getItem('ci-dashboard:collapsed')).toContain('a')
  })

  it('collapseAll then expandAll', () => {
    const { result } = renderHook(() => useCollapseState())
    act(() => result.current.collapseAll(['a', 'b']))
    expect(result.current.allCollapsed(['a', 'b'])).toBe(true)
    act(() => result.current.expandAll())
    expect(result.current.isCollapsed('a')).toBe(false)
  })

  it('seeds from existing localStorage', () => {
    localStorage.setItem('ci-dashboard:collapsed', JSON.stringify(['x']))
    const { result } = renderHook(() => useCollapseState())
    expect(result.current.isCollapsed('x')).toBe(true)
  })
})
