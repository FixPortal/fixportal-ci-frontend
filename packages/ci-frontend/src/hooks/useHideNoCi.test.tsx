import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHideNoCi } from './useHideNoCi'

describe('useHideNoCi', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to not hidden', () => {
    const { result } = renderHook(() => useHideNoCi())
    expect(result.current.hidden).toBe(false)
  })

  it('toggles and persists to localStorage', () => {
    const { result } = renderHook(() => useHideNoCi())
    act(() => {
      result.current.toggle()
    })
    expect(result.current.hidden).toBe(true)
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('true')
    act(() => {
      result.current.toggle()
    })
    expect(result.current.hidden).toBe(false)
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('false')
  })

  it('keeps user visibility changes in memory when storage writes are denied', () => {
    const board = renderHook(() => useHideNoCi())
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota denied')
    })
    try {
      expect(() => {
        act(() => {
          board.result.current.toggle()
        })
      }).not.toThrow()
      expect(board.result.current.hidden).toBe(true)
      expect(save).toHaveBeenLastCalledWith('ci-dashboard:hide-no-ci', 'true')
      expect(() => {
        act(() => {
          board.result.current.toggle()
        })
      }).not.toThrow()
      expect(board.result.current.hidden).toBe(false)
      expect(save).toHaveBeenLastCalledWith('ci-dashboard:hide-no-ci', 'false')
    } finally {
      board.unmount()
      save.mockRestore()
    }
  })

  it('seeds from existing localStorage', () => {
    localStorage.setItem('ci-dashboard:hide-no-ci', 'true')
    const { result } = renderHook(() => useHideNoCi())
    expect(result.current.hidden).toBe(true)
  })

  it('does not overwrite storage when the initial read throws, and persists later toggles', () => {
    localStorage.setItem('ci-dashboard:hide-no-ci', 'true')
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    const { result } = renderHook(() => useHideNoCi())
    getItem.mockRestore()
    expect(result.current.hidden).toBe(false)
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('true')
    act(() => {
      result.current.toggle()
    })
    act(() => {
      result.current.toggle()
    })
    expect(localStorage.getItem('ci-dashboard:hide-no-ci')).toBe('false')
  })
})
