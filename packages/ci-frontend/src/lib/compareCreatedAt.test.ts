import { expect, test } from 'vitest'
import { compareCreatedAt } from './compareCreatedAt'

const pr = (number: number, createdAt: string) => ({ number, createdAt })

test('orders by the instant, not the text, across mixed offsets', () => {
  // 10:00+02:00 is 08:00Z, which is earlier than 09:00Z although it sorts later as text.
  const earlier = pr(1, '2026-05-30T10:00:00+02:00')
  const later = pr(2, '2026-05-30T09:00:00Z')
  expect(compareCreatedAt(earlier, later)).toBeLessThan(0)
  expect(compareCreatedAt(later, earlier)).toBeGreaterThan(0)
})

test('orders mixed fractional-second precision by the instant', () => {
  const earlier = pr(1, '2026-05-30T09:00:00.5Z')
  const later = pr(2, '2026-05-30T09:00:01Z')
  expect(compareCreatedAt(earlier, later)).toBeLessThan(0)
})

test('breaks an equal instant by PR number', () => {
  expect(
    compareCreatedAt(pr(3, '2026-05-30T09:00:00Z'), pr(5, '2026-05-30T11:00:00+02:00')),
  ).toBeLessThan(0)
})

test('sorts an unparseable timestamp last without breaking the comparator', () => {
  const bad = pr(1, 'not a date')
  const good = pr(2, '2026-05-30T09:00:00Z')
  expect(compareCreatedAt(bad, good)).toBeGreaterThan(0)
  expect(compareCreatedAt(good, bad)).toBeLessThan(0)
  expect(compareCreatedAt(bad, bad)).toBe(0)
})
