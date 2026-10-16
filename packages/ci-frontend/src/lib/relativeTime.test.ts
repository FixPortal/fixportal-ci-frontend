import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { formatRelativeTime } from './relativeTime'

const fixedNow = Date.parse('2026-06-01T12:00:00Z')

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function isoMinutesAgo(minutes: number): string {
  return new Date(fixedNow - minutes * 60_000).toISOString()
}

describe('formatRelativeTime', () => {
  it('reports "just now" for the current timestamp', () => {
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

  // Minutes round first; hours round those minutes; days round those hours.
  // These are the existing composed boundaries, not literal hour/day cutoffs.
  it.each([
    ['just-now to minutes', 30_000, 'just now', '1m ago'],
    ['minutes to hours', 3_570_000, '59m ago', '1h ago'],
    ['rounded hour increment', 5_370_000, '1h ago', '2h ago'],
    ['hours to days', 84_570_000, '23h ago', '1d ago'],
    ['rounded day increment', 127_770_000, '1d ago', '2d ago'],
  ] as const)('formats both sides of the %s transition', (_label, ageMs, before, at) => {
    expect(formatRelativeTime(new Date(fixedNow - (ageMs - 1)).toISOString())).toBe(before)
    expect(formatRelativeTime(new Date(fixedNow - ageMs).toISOString())).toBe(at)
  })
})
