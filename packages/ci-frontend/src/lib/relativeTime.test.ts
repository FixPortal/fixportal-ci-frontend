import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './relativeTime'

// Computed relative to real Date.now() at call time rather than a frozen system
// clock, so the small delay between building the fixture and formatRelativeTime's
// own Date.now() call can't cross a threshold boundary (values below are well
// clear of 1m / 60m / 24h boundaries).
function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

describe('formatRelativeTime', () => {
  it('reports "just now" for a timestamp under a minute old', () => {
    expect(formatRelativeTime(isoMinutesAgo(0))).toBe('just now')
  })

  it('reports minutes for a timestamp under an hour old', () => {
    expect(formatRelativeTime(isoMinutesAgo(5))).toBe('5m ago')
  })

  it('reports hours for a timestamp under a day old', () => {
    expect(formatRelativeTime(isoMinutesAgo(3 * 60))).toBe('3h ago')
  })

  it('reports days for a timestamp a day or more old', () => {
    expect(formatRelativeTime(isoMinutesAgo(2 * 24 * 60))).toBe('2d ago')
  })

  it('falls back to an empty string for an unparseable timestamp (not "NaNm ago")', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
  })
})
