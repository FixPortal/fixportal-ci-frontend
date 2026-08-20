import type { RepositorySnapshot } from '../api/types'

// A repository is "No CI" when it has no workflows at all — the same definition
// the backend uses for the `no-ci` summary count (repos with Workflows.Count == 0).
export function isNoCi(repository: RepositorySnapshot): boolean {
  return (repository.workflows?.length ?? 0) === 0
}
