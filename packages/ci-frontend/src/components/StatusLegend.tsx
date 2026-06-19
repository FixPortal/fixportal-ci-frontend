import type { SignalState } from '../api/types'

// Decodes the board's primary visual language — the status dot colours and
// shapes — for a first-time visitor. Sits beside the Lizard MetricsLegend at
// the foot of the board. Swatches mirror the live dot treatment: colour plus a
// non-colour shape cue (square = failing) so the key reads in grayscale too.
const STATUS_ITEMS: ReadonlyArray<readonly [SignalState, string]> = [
  ['success', 'passing'],
  ['failure', 'failing'],
  ['running', 'running'],
  ['unknown', 'unknown / no runs'],
]

export function StatusLegend() {
  return (
    <footer className="status-legend" aria-label="Status colour key">
      <span className="status-legend__title">Status</span>
      {STATUS_ITEMS.map(([state, label]) => (
        <span key={state} className="status-legend__item">
          <span className="status-legend__dot" data-state={state} aria-hidden="true" />
          {label}
        </span>
      ))}
      <span className="status-legend__item">
        <span className="status-legend__noci" aria-hidden="true" />
        No-CI repo
      </span>
      <span className="status-legend__gloss">
        <b>CI</b> workflow runs · <b>CD</b> deploys &amp; packages
      </span>
    </footer>
  )
}
