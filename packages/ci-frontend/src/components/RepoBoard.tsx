import { memo } from 'react'
import type { RepositorySnapshot } from '../api/types'
import { isNoCi } from '../lib/isNoCi'
import { isAllowedHref } from '../lib/isAllowedHref'
import { SignalChip } from './SignalChip'
import { RepoMetricsLine } from './RepoMetricsLine'
import { PullRequestList } from './PullRequestList'
import { JobLaneRow } from './JobLaneRow'
import { RepoActivityIndicator } from './RepoActivityIndicator'

// Memoised so a poll tick that returns the same data (React Query preserves the
// repository reference via structural sharing) doesn't re-render every board.
// onToggle takes the repo name so the parent can pass one stable callback rather
// than a fresh per-repo closure that would defeat the memo.
export const RepoBoard = memo(function RepoBoard({
  repository, collapsed, onToggle,
}: {
  repository: RepositorySnapshot
  collapsed: boolean
  onToggle: (name: string) => void
}) {
  const pullRequests = repository.pullRequests ?? []
  const noCi = isNoCi(repository)
  const ghHref = isAllowedHref(repository.htmlUrl)
  return (
    <section className={`repo-board${collapsed ? ' repo-board--collapsed' : ''}${noCi ? ' repo-board--no-ci' : ''}`}>
      <header>
        <button type="button" className="repo-board__toggle" onClick={() => onToggle(repository.name)} aria-expanded={!collapsed}>
          <span className="repo-board__chev" aria-hidden="true">▸</span>
          {repository.name}
        </button>
        {noCi && <span className="repo-board__noci-tag">No CI</span>}
        <RepoMetricsLine metrics={repository.metrics} />
        <RepoActivityIndicator repository={repository} />
        {ghHref !== '#' ? (
          <a className="repo-board__gh-link" href={ghHref} target="_blank" rel="noopener noreferrer" aria-label={`Open ${repository.name} on GitHub`}>
            GitHub ↗
          </a>
        ) : (
          <span className="repo-board__gh-link repo-board__gh-link--static" aria-label={`${repository.name} GitHub link unavailable`}>
            GitHub
          </span>
        )}
      </header>
      {!collapsed && (
        <>
          {repository.workflows.length === 0 ? (
            <div className="repo-board__empty">no workflows</div>
          ) : (
            <div className="repo-workflows">
              <span className="repo-workflows__label">Workflows · {repository.workflows.length}</span>
              <div className="repo-top-signals">
                {repository.workflows.map(wf => (
                  <SignalChip key={wf.file} workflow={wf} />
                ))}
              </div>
            </div>
          )}
          <JobLaneRow kind="deploys" glyph="▲" label="Deploys" signals={repository.deploys ?? []} />
          <JobLaneRow kind="packages" glyph="▣" label="Packages" signals={repository.packages ?? []} />
          <PullRequestList pullRequests={pullRequests} />
        </>
      )}
    </section>
  )
})
