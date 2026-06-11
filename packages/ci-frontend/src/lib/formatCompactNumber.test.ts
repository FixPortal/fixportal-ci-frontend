import { describe, it, expect } from 'vitest'
import { formatCompactNumber } from './formatCompactNumber'

describe('formatCompactNumber', () => {
  it('formats small numbers as string representation', () => {
    expect(formatCompactNumber(0)).toBe('0')
    expect(formatCompactNumber(999)).toBe('999')
  })

  it('formats thousands with k suffix', () => {
    expect(formatCompactNumber(1000)).toBe('1.0k')
    expect(formatCompactNumber(12345)).toBe('12.3k')
    expect(formatCompactNumber(999949)).toBe('999.9k')
  })

  it('promotes boundary values to M suffix', () => {
    expect(formatCompactNumber(999950)).toBe('1.0M')
    expect(formatCompactNumber(1000000)).toBe('1.0M')
    expect(formatCompactNumber(2500000)).toBe('2.5M')
  })
})
