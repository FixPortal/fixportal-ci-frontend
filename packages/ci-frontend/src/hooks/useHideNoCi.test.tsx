import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHideNoCi } from './useHideNoCi'

describe('useHideNoCi', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to not hidden', () => {
    const { result } = renderHook(() => useHideNoCi())
    expect(result.current.hidden).toBe(false)
  })

  it('toggles and persists to localStorage', () => {
    const { result } = renderHook(() => useHideNoCi())
    act(() => result.current.toggle())
    expect(result.current.hidden).toBe(true)
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('true')
    act(() => result.current.toggle())
    expect(result.current.hidden).toBe(false)
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('false')
  })

  it('seeds from existing localStorage', () => {
    localStorage.setItem('ci-dashboard:hide-no-ci', 'true')
    const { result } = renderHook(() => useHideNoCi())
    expect(result.current.hidden).toBe(true)
  })
})
