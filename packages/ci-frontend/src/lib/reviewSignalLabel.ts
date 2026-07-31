import type { ReviewSignal } from '../api/types'

// The spoken form of a reviewer's state, rendered into each pill's accessible
// name (an .sr-only span) so the signal is never colour-only. Mirrors
// stateLabel.ts, including its deliberate Record<string, string> keying: the
// snapshot boundary does no runtime validation, so an out-of-union value from a
// newer backend must index to undefined and hit the fallback rather than have TS
// assume the lookup is total and elide the guard.
const STATE_LABELS: Record<string, string> = {
  clean: 'clean',
  outstanding: 'outstanding',
  pending: 'not yet reviewed',
  disabled: 'not required',
}

export function reviewSignalLabel(signal: ReviewSignal): string {
  if (signal.state === 'outstanding' && typeof signal.count === 'number') {
    return `${signal.name}: ${signal.count} outstanding`
  }
  return `${signal.name}: ${STATE_LABELS[signal.state] ?? 'status unknown'}`
}
