import type { PullRequest } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'
import { isAllowedHref } from '../lib/isAllowedHref'
import { useCiAdmin } from '../CiAdminContext'
import { usePrMerge } from '../hooks/usePrMerge'
import type { PrMerge } from '../hooks/usePrMerge'
import { ReviewPills } from './ReviewPills'
import { ReadyToMergePill } from './ReadyToMergePill'

export function PullRequestList({ pullRequests, repoName }: { pullRequests: PullRequest[]; repoName: string }) {
  const isAdmin = useCiAdmin()
  if (pullRequests.length === 0) return null
  // Merge state lives in an admin-only child so the guest render never touches
  // usePrMerge -- it needs QueryClient/CiConfig providers guests don't have.
  if (!isAdmin) return <PullRequestListView pullRequests={pullRequests} />
  return <AdminPullRequestList pullRequests={pullRequests} repoName={repoName} />
}

function AdminPullRequestList({ pullRequests, repoName }: { pullRequests: PullRequest[]; repoName: string }) {
  const merge = usePrMerge(repoName)
  return <PullRequestListView pullRequests={pullRequests} merge={merge} />
}

function PullRequestListView({ pullRequests, merge }: { pullRequests: PullRequest[]; merge?: PrMerge }) {
  // Strict === true, same rule as the pill itself: never coerce the tri-state.
  const readyPrs = pullRequests.filter(pr => pr.readyToMerge === true)
  return (
    <div className="repo-prs">
      <span className="repo-prs__count">
        {pullRequests.length} open PR{pullRequests.length === 1 ? '' : 's'}
      </span>
      {/* One ready PR has its own pill; Merge all only earns its place at two+. */}
      {merge && readyPrs.length >= 2 && (
        <button
          type="button"
          className="chip chip--actionable repo-prs__merge-all"
          disabled={merge.merging !== null}
          onClick={() => merge.mergeAll(readyPrs.map(pr => pr.number))}
        >
          Merge all
        </button>
      )}
      {merge && merge.error !== null && (
        <span className="repo-prs__merge-error" role="alert">
          {merge.error}
          <button type="button" aria-label="Dismiss" onClick={merge.dismissError}>✕</button>
        </span>
      )}
      <ul>
        {pullRequests.map(pr => {
          const href = isAllowedHref(pr.htmlUrl)
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
                    onMerge={merge ? () => merge.mergeOne(pr.number) : undefined}
                    busy={merge !== undefined && (merge.merging === pr.number || merge.merging === 'all')}
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
