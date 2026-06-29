import { useState } from 'react'
import type { SignalState } from '../api/types'

const STATUS_ITEMS: ReadonlyArray<readonly [SignalState, string]> = [
  ['success', 'passing'],
  ['failure', 'failing'],
  ['running', 'running'],
  ['unknown', 'unknown'],
]

export function LegendRow() {
  const [open, setOpen] = useState(false)
  return (
    <div className="legend-row">
      <button
        type="button"
        className="legend-row__toggle"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        Legend {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="legend-row__content">
          <div className="legend-row__status">
            <span className="legend-row__label">Status</span>
            {STATUS_ITEMS.map(([state, label]) => (
              <span key={state} className="legend-row__item">
                <span className="legend-row__dot" data-state={state} aria-hidden="true" />
                {label}
              </span>
            ))}
            <span className="legend-row__item">
              <span className="legend-row__noci" aria-hidden="true" />
              No-CI
            </span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span className="legend-row__gloss">
              <b>CI</b> = workflow runs · <b>CD</b> = deploys &amp; packages
            </span>
          </div>
          <div className="legend-row__metrics">
            <a className="legend-row__label" href="https://github.com/terryyin/lizard" target="_blank" rel="noopener noreferrer">Lizard metrics</a>
          </div>
          <div className="legend-row__defs">
            <span><b>NLOC</b> non-comment lines of code</span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span><a href="https://en.wikipedia.org/wiki/Cyclomatic_complexity" target="_blank" rel="noopener noreferrer"><b>avg CCN</b></a> cyclomatic complexity</span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span><b>functions</b> count</span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span><b>complex</b> functions over CCN&nbsp;15</span>
          </div>
        </div>
      )}
    </div>
  )
}
