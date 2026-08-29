import type { PullRequest } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'
import { isAllowedHref } from '../lib/isAllowedHref'
import type { PrMerge } from '../lib/prMerge'
import { isPrBusy, isRepoMerging, prMergeKey } from '../lib/prMerge'
import { ReviewPills } from './ReviewPills'
import { ReadyToMergePill } from './ReadyToMergePill'

// Presentational: merge state is hoisted to the page (usePrMerge) and handed
// down as props. Guests get no `merge` (and isAdmin false), so their render is
// exactly what it was before the merge feature.
export function PullRequestList({ pullRequests, repoName, isAdmin, merge }: {
  pullRequests: PullRequest[]
  repoName: string
  isAdmin?: boolean
  merge?: PrMerge
}) {
  if (pullRequests.length === 0) return null
  // Strict === true, same rule as the pill itself: never coerce the tri-state.
  const readyPrs = pullRequests.filter(pr => pr.readyToMerge === true && !merge?.merged.has(prMergeKey(repoName, pr.number)))
  const openPrCount = pullRequests.filter(pr => !merge?.merged.has(prMergeKey(repoName, pr.number))).length
  const merging = merge?.merging
  return (
    <div className="repo-prs">
      <span className="repo-prs__count">
        {openPrCount} open PR{openPrCount === 1 ? '' : 's'}
      </span>
      {/* One ready PR has its own pill; Merge all only earns its place at two+. */}
      {isAdmin && merge && readyPrs.length >= 2 && (
        <button
          type="button"
          className="chip chip--actionable repo-prs__merge-all"
          disabled={isRepoMerging(merge.merging, repoName)}
          onClick={() => merge.mergeAll(repoName, readyPrs.map(pr => pr.number))}
        >
          Merge all
        </button>
      )}
      {isAdmin && merge?.errors.has(repoName) && (
        <span className="repo-prs__merge-error" role="alert">
          {merge.errors.get(repoName)}
          <button type="button" aria-label="Dismiss" onClick={() => merge.dismissError(repoName)}>✕</button>
        </span>
      )}
      <ul>
        {pullRequests.map(pr => {
          const href = isAllowedHref(pr.htmlUrl)
          const key = prMergeKey(repoName, pr.number)
          const locallyMerged = merge?.merged.has(key) ?? false
          return (
            <li key={pr.number} className={pr.isDraft ? 'repo-prs__item repo-prs__item--draft' : 'repo-prs__item'}>
              {/* The link and the pills share one flex line so the pills can take the
                  row's unused right-hand space -- see .repo-prs__line in board.css.
                  The pills stay OUTSIDE the anchor: each one carries its own link, and
                  an anchor inside an anchor is invalid. */}
              <div className="repo-prs__line">
                {href !== '#' ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <span className="repo-prs__num">#{pr.number}</span>
                    <span className="repo-prs__title">{pr.title}</span>
                  </a>
                ) : (
                  <span className="repo-prs__static">
                    <span className="repo-prs__num">#{pr.number}</span>
                    <span className="repo-prs__title">{pr.title}</span>
                  </span>
                )}
                {/* Both badge groups share one flex child so .repo-prs__line's
                    space-between keeps them together on the right, rather than
                    stranding the verdict pill in the middle of the row. */}
                <div className="repo-prs__badges">
                  <ReadyToMergePill
                    ready={pr.readyToMerge}
                    prNumber={pr.number}
                    onMerge={isAdmin && merge ? () => merge.mergeOne(repoName, pr.number) : undefined}
                    merging={merging?.has(key) ?? false}
                    merged={locallyMerged}
                    // Busy is per-PR: only this pill's own merge (or a Merge all
                    // working through its repo) disables it. Every other pill on
                    // the board stays clickable, and its click really does merge.
                    busy={merging ? isPrBusy(merging, repoName, pr.number) : false}
                  />
                  <ReviewPills signals={pr.reviewSignals} />
                </div>
              </div>
              <span className="repo-prs__meta">
                {pr.author} · {formatRelativeTime(pr.createdAt)}{pr.isDraft ? ' · draft' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
