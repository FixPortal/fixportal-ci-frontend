import type { RepoMetrics } from '../api/types'
import { formatCompactNumber } from '../lib/formatCompactNumber'

export function RepoMetricsLine({ metrics }: { metrics: RepoMetrics | null }) {
  if (!metrics || metrics.nloc === 0) return null
  return (
    <dl className="repo-metrics" aria-label="code metrics">
      <div title="non-comment lines of code"><dt>NLOC</dt><dd>{formatCompactNumber(metrics.nloc)}</dd></div>
      <div title="average cyclomatic complexity (branch paths per function)"><dt>avg CCN</dt><dd>{metrics.avgComplexity.toFixed(1)}</dd></div>
      <div title="number of functions"><dt>functions</dt><dd>{formatCompactNumber(metrics.functionCount)}</dd></div>
      {metrics.highComplexityCount > 0 && (
        <div className="repo-metrics__complex" title="functions over CCN 15 — refactor candidates">
          <dt>complex</dt><dd>{metrics.highComplexityCount}</dd>
        </div>
      )}
    </dl>
  )
}
