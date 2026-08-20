import { describe, it, expect } from 'vitest'
import { prAgeTone } from './prAgeTone'

const NOW = Date.parse('2026-05-30T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

describe('prAgeTone', () => {
  it('is quiet for <= 7 days', () => {
    expect(prAgeTone(daysAgo(1), NOW)).toBe('quiet')
    expect(prAgeTone(daysAgo(7), NOW)).toBe('quiet')
  })
  it('is amber for > 7 and <= 14 days', () => {
    expect(prAgeTone(daysAgo(8), NOW)).toBe('amber')
    expect(prAgeTone(daysAgo(14), NOW)).toBe('amber')
  })
  it('is red for > 14 days', () => {
    expect(prAgeTone(daysAgo(15), NOW)).toBe('red')
  })
})
