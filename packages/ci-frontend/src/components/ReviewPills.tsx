import { memo } from 'react'
import type { ReviewSignal } from '../api/types'
import { isAllowedHref } from '../lib/isAllowedHref'
import { reviewSignalLabel } from '../lib/reviewSignalLabel'

// Only a settled state earns a link. A pending pill has nothing to point at yet,
// and a disabled one is not applicable here — linking either would invite a click
// that lands on an empty page.
const LINKABLE: ReadonlySet<string> = new Set(['clean', 'outstanding'])

// Memoised for the same reason as SignalChip: on a no-change poll tick React Query
// preserves the signal array's reference (structural sharing), so the row skips
// re-rendering every 20 seconds.
export const ReviewPills = memo(function ReviewPills({ signals }: { signals?: ReviewSignal[] | null }) {
  if (!signals || signals.length === 0) return null
  return (
    <div className="review-pills">
      {signals.map(signal => {
        const label = reviewSignalLabel(signal)
        // Derive linkability from the sanitized href, never from raw truthiness: a
        // URL that is truthy but rejected by isAllowedHref must degrade to a static
        // span, not become a dead <a href="#"> (same rule as SignalChip).
        const href = LINKABLE.has(signal.state) ? isAllowedHref(signal.htmlUrl ?? undefined) : '#'
        const linkable = href !== '#'
        const className = `chip chip--review-${signal.state}${linkable ? '' : ' chip--static'}`
        const body = (
          <>
            <span className="chip__dot" aria-hidden="true" />
            <span className="chip__label">{signal.name}</span>
            {/* State in words for SR / colour-blind users — the dot is colour+shape only. */}
            <span className="sr-only">{label}</span>
            {signal.state === 'outstanding' && typeof signal.count === 'number' ? (
              <span className="chip__meta">{signal.count}</span>
            ) : null}
          </>
        )
        return linkable ? (
          <a
            key={signal.name}
            className={className}
            href={href}
            title={label}
            target="_blank"
            rel="noopener noreferrer"
          >
            {body}
          </a>
        ) : (
          <span key={signal.name} className={className} title={label}>
            {body}
          </span>
        )
      })}
    </div>
  )
})
