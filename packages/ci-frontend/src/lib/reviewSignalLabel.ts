import type { ReviewSignal } from '../api/types'

// The spoken form of a reviewer's state, rendered into each pill's accessible
// name (an .sr-only span) so the signal is never colour-only. Mirrors
// stateLabel.ts, including its deliberate Record<string, string> keying: an
// out-of-union value from a newer backend must hit the fallback rather than
// have TS assume the lookup is total and elide the guard. The lookup goes
// through Object.hasOwn (as stateModifier does) so a state like "toString"
// cannot resolve to a native Object.prototype member and stringify into the
// label.
const STATE_LABELS: Record<string, string> = {
  clean: 'clean',
  outstanding: 'outstanding',
  pending: 'not yet reviewed',
  disabled: 'not required',
}

export function reviewSignalLabel(signal: ReviewSignal): string {
  // Number.isFinite, not typeof: NaN is a number and must not render as
  // "CodeRabbit: NaN outstanding".
  if (signal.state === 'outstanding' && Number.isFinite(signal.count)) {
    return `${signal.name}: ${signal.count} outstanding`
  }
  const state = Object.hasOwn(STATE_LABELS, signal.state) ? STATE_LABELS[signal.state] : 'status unknown'
  return `${signal.name}: ${state}`
}
