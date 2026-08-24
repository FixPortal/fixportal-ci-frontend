import { memo } from 'react'

// The whole-PR verdict, not a per-reviewer state: every required reviewer is clean
// and nothing is outstanding. Rendered as a solid pill so it does not read as one
// more entry in the .review-pills row beside it.
//
// Strict `=== true`, matching hasReadyPr in applyRepoFilters: the field is tri-state,
// and both false ("not ready") and null/absent ("not yet determined", or an older
// backend that never sends it) must render nothing rather than be coerced. An absent
// pill claims nothing; a wrong one sends Chris to merge a PR that isn't ready.
//
// When onMerge is supplied (admin viewers), the pill becomes the merge action
// itself — a rebase merge via the backend, disabled while a merge is in flight.
// The button then gets an action-oriented accessible name (distinct from the
// toolbar's "Ready to merge" filter chip, and identifying its PR) while the
// visible label stays the board's verdict wording.
export const ReadyToMergePill = memo(function ReadyToMergePill({
  ready, onMerge, busy, prNumber,
}: {
  ready?: boolean | null
  onMerge?: () => void
  busy?: boolean
  prNumber?: number
}) {
  if (ready !== true) return null
  if (!onMerge) {
    return (
      <span className="chip chip--static chip--ready" title="Ready to merge">
        <span className="chip__dot" aria-hidden="true" />
        <span className="chip__label">Ready to merge</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      className="chip chip--ready chip--actionable"
      title="Rebase-merge this PR"
      aria-label={prNumber !== undefined ? `Rebase-merge PR #${prNumber}` : 'Rebase-merge this PR'}
      disabled={busy}
      onClick={onMerge}
    >
      <span className="chip__dot" aria-hidden="true" />
      <span className="chip__label">Ready to merge</span>
    </button>
  )
})
