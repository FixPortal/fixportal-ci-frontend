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
  ready, onMerge, busy, merging, merged, prNumber,
}: {
  ready?: boolean | null
  onMerge?: () => void
  busy?: boolean
  merging?: boolean
  merged?: boolean
  prNumber?: number
}) {
  if (ready !== true && !merged) return null
  let label = 'Ready to merge'
  let title = onMerge ? 'Rebase-merge this PR' : 'Ready to merge'
  let accessibleAction = 'Rebase-merge'
  if (merging) {
    label = 'Merging…'
    title = 'Merge in progress'
    accessibleAction = 'Merging'
  }
  if (merged) {
    label = '✓ Merged'
    title = 'Merge completed'
    accessibleAction = 'Merged'
  }
  if (!onMerge) {
    return (
      <span className="chip chip--static chip--ready" title={title}>
        <span className="chip__dot" aria-hidden="true" />
        <span className="chip__label">{label}</span>
      </span>
    )
  }
  const accessibleLabel = prNumber === undefined
    ? `${accessibleAction} pull request`
    : `${accessibleAction} PR #${prNumber}`
  return (
    <button
      type="button"
      className="chip chip--ready chip--actionable"
      title={title}
      aria-label={accessibleLabel}
      aria-live="polite"
      disabled={busy || merged}
      onClick={onMerge}
    >
      <span className="chip__dot" aria-hidden="true" />
      <span className="chip__label">{label}</span>
    </button>
  )
})
