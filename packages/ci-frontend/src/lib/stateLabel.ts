import type { SignalState } from '../api/types'

// The spoken form of a workflow/job state. Status on the board is carried
// visually by dot colour + dot shape; this is the text equivalent rendered
// into each chip's accessible name (an .sr-only span) so screen-reader and
// colour-blind users get the state in words — not a colour-only signal.
// (WCAG 2.2 SC 1.4.1 / 1.1.1.)
// Keyed by string, not SignalState, so an out-of-union value (untrusted snapshot
// JSON / backend version skew — the API boundary does no runtime validation)
// indexes to undefined and hits the fallback below, rather than TS assuming the
// lookup is total and eliding the guard.
const STATE_LABELS: Record<string, string> = {
  success: 'passing',
  failure: 'failing',
  running: 'running',
  unknown: 'status unknown',
}

export function stateLabel(state: SignalState): string {
  // Fallback keeps the chip's accessible name non-empty for an unrecognised state.
  return STATE_LABELS[state] ?? 'status unknown'
}
