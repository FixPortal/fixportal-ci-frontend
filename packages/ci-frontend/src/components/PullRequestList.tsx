import type { PullRequest } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'
import { isAllowedHref } from '../lib/isAllowedHref'
import { ReviewPills } from './ReviewPills'
import { ReadyToMergePill } from './ReadyToMergePill'

export function PullRequestList({ pullRequests }: { pullRequests: PullRequest[] }) {
  if (pullRequests.length === 0) return null
  return (
    <div className="repo-prs">
      <span className="repo-prs__count">
        {pullRequests.length} open PR{pullRequests.length === 1 ? '' : 's'}
      </span>
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
                  <ReadyToMergePill ready={pr.readyToMerge} />
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
