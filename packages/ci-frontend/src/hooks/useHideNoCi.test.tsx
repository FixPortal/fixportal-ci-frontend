import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('does not overwrite storage when the initial read throws, and persists later toggles', () => {
    localStorage.setItem('ci-dashboard:hide-no-ci', 'true')
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage denied') })
    const { result } = renderHook(() => useHideNoCi())
    getItem.mockRestore()
    expect(result.current.hidden).toBe(false)
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('true')
    act(() => result.current.toggle())
    act(() => result.current.toggle())
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('false')
  })
})
