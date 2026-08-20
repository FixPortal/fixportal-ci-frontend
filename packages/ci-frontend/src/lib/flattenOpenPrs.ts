import type { PullRequest, RepositorySnapshot } from '../api/types'

export type OpenPr = PullRequest & { repo: string }

// Aggregate every repo's open PRs into one list tagged with its repo, oldest-first
// (the most stale surface first for triage).
export function flattenOpenPrs(repositories: RepositorySnapshot[]): OpenPr[] {
  return repositories
    .flatMap(r => (r.pullRequests ?? []).map(pr => ({ ...pr, repo: r.name })))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}
