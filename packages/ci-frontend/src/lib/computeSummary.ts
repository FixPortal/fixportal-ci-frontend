import type { RepositorySnapshot, SummaryCount } from '../api/types'
import { isNoCi } from './isNoCi'

// Keys that always appear in the summary, even at zero, so the strip structure
// is stable regardless of the filtered repo set. Mirrors what the server sends
// in snapshot.data.summary so admin and guest panels look the same.
const ALWAYS_VISIBLE_KEYS = new Set([
  'repos', 'workflows', 'nloc',        // inventory
  'open-prs',                           // Review panel (carries next-in-queue / last-merged)
  'running', 'failing', 'no-ci',        // core CI status
  'deploys-running', 'deploys-failing', // deploy lane (zero = nothing deploying / all clean)
  'packages-failing',                   // package lane
])

// Recomputes summary counts from a filtered repo list. Mirrors the server-side
// aggregation so the strip reflects exactly the repos being displayed.
export function computeSummary(repos: RepositorySnapshot[]): SummaryCount[] {
  const workflows = repos.flatMap(r => r.workflows)
  const deploys = repos.flatMap(r => r.deploys ?? [])
  const packages = repos.flatMap(r => r.packages ?? [])
  const openPrs = repos.flatMap(r => r.pullRequests ?? [])
  const nloc = repos.reduce((acc, r) => acc + (r.metrics?.nloc ?? 0), 0)

  const all: SummaryCount[] = [
    { key: 'repos', count: repos.length },
    { key: 'workflows', count: workflows.length },
    { key: 'failing', count: workflows.filter(w => w.state === 'failure').length },
    { key: 'running', count: workflows.filter(w => w.state === 'running').length },
    { key: 'no-ci', count: repos.filter(isNoCi).length },
    { key: 'open-prs', count: openPrs.length },
    { key: 'nloc', count: nloc },
    { key: 'deploys-failing', count: deploys.filter(d => d.state === 'failure').length },
    { key: 'deploys-running', count: deploys.filter(d => d.state === 'running').length },
    { key: 'packages-failing', count: packages.filter(p => p.state === 'failure').length },
  ]

  return all.filter(c => ALWAYS_VISIBLE_KEYS.has(c.key) || c.count > 0)
}
