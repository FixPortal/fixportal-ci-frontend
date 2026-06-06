import type { PullRequest } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'
import { isAllowedHref } from '../lib/isAllowedHref'

export function PullRequestList({ pullRequests }: { pullRequests: PullRequest[] }) {
  if (pullRequests.length === 0) return null
  return (
    <div className="repo-prs">
      <span className="repo-prs__count">
        {pullRequests.length} open PR{pullRequests.length === 1 ? '' : 's'}
      </span>
      <ul>
        {pullRequests.map(pr => (
          <li key={pr.number} className={pr.isDraft ? 'repo-prs__item repo-prs__item--draft' : 'repo-prs__item'}>
            <a href={isAllowedHref(pr.htmlUrl)} target="_blank" rel="noopener noreferrer">
              <span className="repo-prs__num">#{pr.number}</span>
              <span className="repo-prs__title">{pr.title}</span>
            </a>
            <span className="repo-prs__meta">
              {pr.author} · {formatRelativeTime(pr.createdAt)}{pr.isDraft ? ' · draft' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
