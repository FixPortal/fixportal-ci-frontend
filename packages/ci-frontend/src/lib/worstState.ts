import type { SignalState } from '../api/types'

export type Activity = 'failure' | 'running' | 'success' | 'none'

// Precedence for a repo's worst signal across a set of states: a failure dominates,
// then anything running, then a clean success; an empty/all-unknown set reads as
// "none" (hollow indicator).
export function worstState(states: SignalState[]): Activity {
  if (states.includes('failure')) return 'failure'
  if (states.includes('running')) return 'running'
  if (states.includes('success')) return 'success'
  return 'none'
}
