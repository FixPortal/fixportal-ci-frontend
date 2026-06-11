import type { RepositorySnapshot } from '../api/types'
import { worstState } from '../lib/worstState'

export function RepoActivityIndicator({ repository }: { repository: RepositorySnapshot }) {
  const prCount = (repository.pullRequests ?? []).length
  const ci = worstState((repository.workflows ?? []).map(w => w.state))
  const cd = worstState([...(repository.deploys ?? []), ...(repository.packages ?? [])].map(s => s.state))
  return (
    <span className="repo-activity">
      {prCount > 0 && <span className="repo-activity__pr">{prCount} PR</span>}
      <span className="repo-activity__sig">CI<span className="repo-activity__dot" data-activity={ci} role="img" aria-label={`CI ${ci}`} /></span>
      <span className="repo-activity__sig">CD<span className="repo-activity__dot" data-activity={cd} role="img" aria-label={`CD ${cd}`} /></span>
    </span>
  )
}
