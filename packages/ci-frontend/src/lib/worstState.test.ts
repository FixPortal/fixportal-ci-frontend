import { describe, it, expect } from 'vitest'
import { worstState } from './worstState'

describe('worstState', () => {
  it('returns none for an empty or all-unknown list', () => {
    expect(worstState([])).toBe('none')
    expect(worstState(['unknown', 'unknown'])).toBe('none')
  })
  it('prefers failure over everything', () => {
    expect(worstState(['success', 'running', 'failure', 'unknown'])).toBe('failure')
  })
  it('prefers running over success', () => {
    expect(worstState(['success', 'running'])).toBe('running')
  })
  it('returns success when only successes (and unknowns)', () => {
    expect(worstState(['success', 'unknown'])).toBe('success')
  })
})
