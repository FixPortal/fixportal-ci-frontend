import { memo } from 'react'
import type { ReviewSignal } from '../api/types'
import { isAllowedHref } from '../lib/isAllowedHref'
import { reviewSignalLabel, isValidSignalCount } from '../lib/reviewSignalLabel'

// Only a settled state earns a link. A pending pill has nothing to point at yet,
// and a disabled one is not applicable here — linking either would invite a click
// that lands on an empty page.
const LINKABLE: ReadonlySet<string> = new Set(['clean', 'outstanding'])

// The states this library has CSS for. An out-of-union state from a newer
// backend must still render -- dropping it would read as "reviewer not
// configured", a stronger and wronger claim than "we don't know its state"
// -- but it must never inherit the bare `.chip` look (solid border, filled
// dot) that an unmatched `chip--review-<raw state>` class would fall back
// to, since that reads as settled. Route anything outside this set to the
// dedicated `chip--review-unknown` modifier instead.
const KNOWN_STATES: ReadonlySet<string> = new Set(['clean', 'outstanding', 'pending', 'disabled'])

// Memoised for the same reason as SignalChip: on a no-change poll tick React Query
// preserves the signal array's reference (structural sharing), so the row skips
// re-rendering every 20 seconds.
export const ReviewPills = memo(function ReviewPills({ signals }: { signals?: ReviewSignal[] | null }) {
  if (!Array.isArray(signals) || signals.length === 0) return null
  // The snapshot boundary does no runtime validation of the array's CONTENTS (this is a
  // published library -- consumers point it at their own backends), so a null or malformed
  // entry can reach here despite the ReviewSignal[] type. A throw during render would
  // propagate out of this dialog-mounted component with no ErrorBoundary anywhere in src,
  // unmounting the stepper's <dialog> without running its cleanup effect -- onClose never
  // fires, and the parent's stepperOpen sticks true, wedging the Open-PRs button for the
  // rest of the session. Skip bad entries instead. Same posture as reviewSignalLabel's
  // Record<string, string> keying: never assume the snapshot is total.
  const wellFormed = signals.filter(
    (s): s is ReviewSignal => typeof s === 'object' && s !== null && typeof s.name === 'string' && typeof s.state === 'string',
  )
  if (wellFormed.length === 0) return null
  return (
    <div className="review-pills">
      {wellFormed.map((signal, i) => {
        const label = reviewSignalLabel(signal)
        // Derive linkability from the sanitized href, never from raw truthiness: a
        // URL that is truthy but rejected by isAllowedHref must degrade to a static
        // span, not become a dead <a href="#"> (same rule as SignalChip).
        const href = LINKABLE.has(signal.state) ? isAllowedHref(signal.htmlUrl ?? undefined) : '#'
        const linkable = href !== '#'
        const stateModifier = KNOWN_STATES.has(signal.state) ? signal.state : 'unknown'
        const className = `chip chip--review-${stateModifier}${linkable ? '' : ' chip--static'}`
        const body = (
          <>
            <span className="chip__dot" aria-hidden="true" />
            <span className="chip__label">{signal.name}</span>
            {/* State in words for SR / colour-blind users — the dot is colour+shape only. */}
            <span className="sr-only">{label}</span>
            {signal.state === 'outstanding' && isValidSignalCount(signal.count) ? (
              <span className="chip__meta">{signal.count}</span>
            ) : null}
          </>
        )
        // Untrusted snapshot data: nothing enforces one entry per reviewer name, so
        // the index is folded into the key to keep duplicates from colliding.
        const key = `${signal.name}-${i}`
        return linkable ? (
          <a
            key={key}
            className={className}
            href={href}
            title={label}
            target="_blank"
            rel="noopener noreferrer"
          >
            {body}
          </a>
        ) : (
          <span key={key} className={className} title={label}>
            {body}
          </span>
        )
      })}
    </div>
  )
})
