import { expect, test } from 'vitest'
import { stateLabel } from './stateLabel'
import type { SignalState } from '../api/types'

test('maps each known state to its spoken label', () => {
  expect(stateLabel('success')).toBe('passing')
  expect(stateLabel('failure')).toBe('failing')
  expect(stateLabel('running')).toBe('running')
  expect(stateLabel('unknown')).toBe('status unknown')
})

test('falls back to a non-empty label for an out-of-union state', () => {
  // Untrusted snapshot JSON / backend version skew can deliver a state outside
  // the union; the accessible name must never render empty. Cast models that.
  expect(stateLabel('cancelled' as SignalState)).toBe('status unknown')
})
