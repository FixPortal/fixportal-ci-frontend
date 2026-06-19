import { memo } from 'react'
import type { JobSignal } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'
import { dedupeJobLabel } from '../lib/dedupeJobLabel'
import { stateLabel } from '../lib/stateLabel'
import { isAllowedHref } from '../lib/isAllowedHref'
// Memoised: the signals array reference is preserved across no-change poll ticks
// (React Query structural sharing), so the lane skips re-rendering.
export const JobLaneRow = memo(function JobLaneRow({
  kind, glyph, label, signals,
}: {
  kind: 'deploys' | 'packages'
  glyph: string
  label: string
  signals: JobSignal[]
}) {
  if (signals.length === 0) return null
  return (
    <div className={`repo-joblane repo-joblane--${kind}`}>
      <span className="repo-joblane__label">{glyph} {label}</span>
      <div className="repo-joblane__chips">
        {signals.map((s, i) => {
          const href = isAllowedHref(s.htmlUrl)
          const linkable = href !== '#'
          const className = `chip chip--${s.state} chip--joblane${linkable ? '' : ' chip--static'}`
          const body = (
            <>
              <span className="chip__dot" aria-hidden="true" />
              <span className="chip__label">{dedupeJobLabel(s.name)}</span>
              {/* State in words for SR / colour-blind users — the dot is colour+shape only. */}
              <span className="sr-only">{stateLabel(s.state)}</span>
              <span className="chip__meta">{formatRelativeTime(s.updatedAt)}</span>
            </>
          )
          return linkable ? (
            <a
              key={`${s.workflow}/${s.name}/${i}`}
              className={className}
              href={href}
              title={`${s.workflow} · ${s.state}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {body}
            </a>
          ) : (
            <span
              key={`${s.workflow}/${s.name}/${i}`}
              className={className}
              title={`${s.workflow} · ${s.state}`}
            >
              {body}
            </span>
          )
        })}
      </div>
    </div>
  )
})
