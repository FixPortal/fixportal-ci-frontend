import type { RepositorySnapshot } from '../api/types'
import { worstState } from '../lib/worstState'

export function RepoActivityIndicator({ repository }: { repository: RepositorySnapshot }) {
  const prCount = (repository.pullRequests ?? []).length
  const ci = worstState((repository.workflows ?? []).map(w => w.state))
  const cd = worstState([...(repository.deploys ?? []), ...(repository.packages ?? [])].map(s => s.state))
  return (
    <span className="repo-activity">
      {prCount > 0 && <span className="repo-activity__pr">{prCount} PR</span>}
      <span className="repo-activity__sig">
        CI
        <img
          src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'/>"
          className="repo-activity__dot"
          data-activity={ci}
          aria-label={`CI ${ci}`}
        />
      </span>
      <span className="repo-activity__sig">
        CD
        <img
          src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'/>"
          className="repo-activity__dot"
          data-activity={cd}
          aria-label={`CD ${cd}`}
        />
      </span>
    </span>
  )
}
