import { memo } from 'react'

// The whole-PR verdict, not a per-reviewer state: every required reviewer is clean
// and nothing is outstanding. Rendered as a solid pill so it does not read as one
// more entry in the .review-pills row beside it.
//
// Strict `=== true`, matching hasReadyPr in applyRepoFilters: the field is tri-state,
// and both false ("not ready") and null/absent ("not yet determined", or an older
// backend that never sends it) must render nothing rather than be coerced. An absent
// pill claims nothing; a wrong one sends Chris to merge a PR that isn't ready.
export const ReadyToMergePill = memo(function ReadyToMergePill({ ready }: { ready?: boolean | null }) {
  if (ready !== true) return null
  return (
    <span className="chip chip--static chip--ready" title="Ready to merge">
      <span className="chip__dot" aria-hidden="true" />
      <span className="chip__label">Ready to merge</span>
    </span>
  )
})
