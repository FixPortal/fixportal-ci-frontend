import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCollapseState } from './useCollapseState'

describe('useCollapseState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to expanded (nothing collapsed)', () => {
    const { result } = renderHook(() => useCollapseState())
    expect(result.current.isCollapsed('a')).toBe(false)
    expect(result.current.allCollapsed(['a', 'b'])).toBe(false)
  })

  it('toggles a repo and persists to localStorage', () => {
    const { result } = renderHook(() => useCollapseState())
    act(() => {
      result.current.toggle('a')
    })
    expect(result.current.isCollapsed('a')).toBe(true)
    expect(localStorage.getItem('ci-dashboard:collapsed')).toContain('a')
  })

  it('collapseAll then expandAll', () => {
    const { result } = renderHook(() => useCollapseState())
    act(() => {
      result.current.collapseAll(['a', 'b'])
    })
    expect(result.current.allCollapsed(['a', 'b'])).toBe(true)
    act(() => {
      result.current.expandAll()
    })
    expect(result.current.isCollapsed('a')).toBe(false)
  })

  it('keeps user collapse changes in memory when storage writes are denied', () => {
    const board = renderHook(() => useCollapseState())
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota denied')
    })
    try {
      expect(() => {
        act(() => {
          board.result.current.toggle('a')
        })
      }).not.toThrow()
      expect(board.result.current.isCollapsed('a')).toBe(true)
      expect(save).toHaveBeenLastCalledWith('ci-dashboard:collapsed', JSON.stringify(['a']))
      expect(() => {
        act(() => {
          board.result.current.expandAll()
        })
      }).not.toThrow()
      expect(board.result.current.isCollapsed('a')).toBe(false)
      expect(() => {
        act(() => {
          board.result.current.collapseAll(['a', 'b'])
        })
      }).not.toThrow()
      expect(board.result.current.allCollapsed(['a', 'b'])).toBe(true)
    } finally {
      board.unmount()
      save.mockRestore()
    }
  })

  it('seeds from existing localStorage', () => {
    localStorage.setItem('ci-dashboard:collapsed', JSON.stringify(['x']))
    const { result } = renderHook(() => useCollapseState())
    expect(result.current.isCollapsed('x')).toBe(true)
  })

  it('falls back to empty (nothing collapsed) on malformed JSON', () => {
    localStorage.setItem('ci-dashboard:collapsed', '{not json')
    const { result } = renderHook(() => useCollapseState())
    expect(result.current.isCollapsed('a')).toBe(false)
    expect(result.current.allCollapsed(['a'])).toBe(false)
  })

  it('does not overwrite storage when the initial read throws', () => {
    localStorage.setItem('ci-dashboard:collapsed', JSON.stringify(['x']))
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    const { result } = renderHook(() => useCollapseState())
    getItem.mockRestore()
    expect(result.current.isCollapsed('x')).toBe(false)
    expect(localStorage.getItem('ci-dashboard:collapsed')).toBe(JSON.stringify(['x']))
  })

  it('drops non-string elements from a corrupt array (untrusted localStorage)', () => {
    localStorage.setItem('ci-dashboard:collapsed', JSON.stringify(['x', 42, null, { y: 1 }]))
    const { result } = renderHook(() => useCollapseState())
    expect(result.current.isCollapsed('x')).toBe(true)
    expect(result.current.isCollapsed('42')).toBe(false)
  })
})
