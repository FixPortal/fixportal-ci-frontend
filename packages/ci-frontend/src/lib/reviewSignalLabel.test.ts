import { expect, test } from 'vitest'
import { reviewSignalLabel } from './reviewSignalLabel'
import type { ReviewSignal } from '../api/types'

const signal = (over: Partial<ReviewSignal>): ReviewSignal => ({ name: 'CodeRabbit', state: 'clean', ...over })

test.each([
  [signal({ state: 'clean' }), 'CodeRabbit: clean'],
  [signal({ state: 'pending' }), 'CodeRabbit: not yet reviewed'],
  [signal({ state: 'disabled' }), 'CodeRabbit: not required'],
  [signal({ state: 'outstanding', count: 3 }), 'CodeRabbit: 3 outstanding'],
  [signal({ state: 'outstanding', count: 1 }), 'CodeRabbit: 1 outstanding'],
])('describes %o as %s', (input, expected) => {
  expect(reviewSignalLabel(input)).toBe(expected)
})

test('falls back to a non-empty name when the count is missing on an outstanding signal', () => {
  expect(reviewSignalLabel(signal({ state: 'outstanding' }))).toBe('CodeRabbit: outstanding')
})

test('falls back rather than rendering an empty accessible name for an out-of-union state', () => {
  const rogue = signal({ state: 'exploded' as ReviewSignal['state'] })
  expect(reviewSignalLabel(rogue)).toBe('CodeRabbit: status unknown')
})
