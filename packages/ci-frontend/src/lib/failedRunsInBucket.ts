import type { RepositorySnapshot, WorkflowRun } from '../api/types'

export interface FailedRun {
  repo: string
  workflow: string
  run: WorkflowRun
}

const HOUR_MS = 3_600_000
const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out'])

function failedWithin(run: WorkflowRun | null | undefined, start: number): run is WorkflowRun {
  if (!run?.conclusion || !FAILED_CONCLUSIONS.has(run.conclusion)) return false
  const at = Date.parse(run.updatedAt)
  return at >= start && at < start + HOUR_MS
}

// Failed runs whose last update falls inside the one-hour bucket. Only runs the
// snapshot already carries (lastRun + recentRuns) can be listed, so an old bucket
// may legitimately come back empty.
export function failedRunsInBucket(
  repositories: RepositorySnapshot[],
  bucketStart: string,
): FailedRun[] {
  const start = Date.parse(bucketStart)
  if (Number.isNaN(start)) return []
  const found = new Map<string, FailedRun>()
  const candidates = repositories.flatMap((repo) =>
    repo.workflows.flatMap((wf) =>
      [wf.lastRun, ...(wf.recentRuns ?? [])].map((run) => ({
        repo: repo.name,
        workflow: wf.name,
        run,
      })),
    ),
  )
  for (const c of candidates) {
    if (failedWithin(c.run, start)) found.set(c.run.htmlUrl, { ...c, run: c.run })
  }
  return [...found.values()].sort((a, b) => b.run.updatedAt.localeCompare(a.run.updatedAt))
}
