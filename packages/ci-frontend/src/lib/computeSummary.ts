import type { RepositorySnapshot, SummaryCount } from '../api/types'
import { isNoCi } from './isNoCi'

// Keys that always appear in the summary, even at zero, so the strip structure
// is stable regardless of the filtered repo set. Mirrors what the server sends
// in snapshot.data.summary so admin and guest panels look the same.
const ALWAYS_VISIBLE_KEYS = new Set([
  'repos', 'workflows', 'nloc-fixportal', 'nloc-quickfixn', 'deploys', 'packages', // inventory
  'open-prs',                           // Review panel (carries next-in-queue / last-merged)
  'running', 'failing', 'no-ci',        // core CI status
  'deploys-running', 'deploys-failing', // deploy lane (zero = nothing deploying / all clean)
  'packages-failing',                   // package lane
])

// The nloc inventory is split into two buckets to mirror the server's summary
// keys. The repo carved into its own bucket is a parameter (defaulting to
// FixPortal's layout) rather than a magic literal, so a consumer with a
// different repo set can override it instead of inheriting our name.
// ponytail: single split point covers the only consumer; generalise to an
// arbitrary bucket list only if a second split is ever needed.
const DEFAULT_NLOC_SPLIT_REPO = 'fixportal-quickfixn'

// Recomputes summary counts from a filtered repo list. Mirrors the server-side
// aggregation so the strip reflects exactly the repos being displayed.
export function computeSummary(
  repos: RepositorySnapshot[],
  nlocSplitRepo: string = DEFAULT_NLOC_SPLIT_REPO,
): SummaryCount[] {
  const workflows = repos.flatMap(r => r.workflows ?? [])
  const deploys = repos.flatMap(r => r.deploys ?? [])
  const packages = repos.flatMap(r => r.packages ?? [])
  const openPrs = repos.flatMap(r => r.pullRequests ?? [])

  const nlocFixportal = repos
    .filter(r => r.name !== nlocSplitRepo)
    .reduce((acc, r) => acc + (r.metrics?.nloc ?? 0), 0)
  const nlocQuickfixn = repos
    .filter(r => r.name === nlocSplitRepo)
    .reduce((acc, r) => acc + (r.metrics?.nloc ?? 0), 0)

  const all: SummaryCount[] = [
    { key: 'repos', count: repos.length },
    { key: 'workflows', count: workflows.length },
    { key: 'failing', count: workflows.filter(w => w.state === 'failure').length },
    { key: 'running', count: workflows.filter(w => w.state === 'running').length },
    { key: 'no-ci', count: repos.filter(isNoCi).length },
    { key: 'open-prs', count: openPrs.length },
    { key: 'nloc-fixportal', count: nlocFixportal },
    { key: 'nloc-quickfixn', count: nlocQuickfixn },
    { key: 'deploys', count: deploys.length },
    { key: 'packages', count: packages.length },
    { key: 'deploys-failing', count: deploys.filter(d => d.state === 'failure').length },
    { key: 'deploys-running', count: deploys.filter(d => d.state === 'running').length },
    { key: 'packages-failing', count: packages.filter(p => p.state === 'failure').length },
  ]

  return all.filter(c => ALWAYS_VISIBLE_KEYS.has(c.key) || c.count > 0)
}
