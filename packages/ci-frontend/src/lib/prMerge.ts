// Merge state handed from the page (usePrMerge) down to presentational
// components as props. The interface lives in lib — not hooks — so components
// can reference the type without an import edge into the hooks layer (the
// architecture spec counts type-only imports as dependencies).
export interface PrMerge {
  // Keys of the merges currently in flight — prMergeKey(repo, n) per PR, plus
  // prMergeKey(repo, 'all') while a Merge all runs. A set, not one slot: a merge
  // is quick, but one global flag greyed out every pill on the board while any
  // single one ran, which reads as the whole screen locking up for one card.
  merging: ReadonlySet<string>
  // Confirmed merges stay here for the session so a stale sweep snapshot cannot
  // put their cards back. receipts is the brief visible success acknowledgement.
  merged: ReadonlySet<string>
  receipts: ReadonlySet<string>
  // Keyed by repo: a merge error belongs to the repo it failed in, so one failure
  // doesn't paint the same alert across every repo section on the board — and with
  // merges able to run concurrently, a second failure must not evict the first.
  errors: ReadonlyMap<string, string>
  mergeOne: (repo: string, pullNumber: number) => Promise<void>
  mergeAll: (repo: string, pullNumbers: number[]) => Promise<void>
  dismissError: (repo: string) => void
}

export function prMergeKey(repo: string, pullNumber: number | 'all'): string {
  return `${repo}#${pullNumber}`
}

// Anything in flight for this repo. Merge all stands down while its own PRs are
// merging, whichever route started them.
export function isRepoMerging(merging: ReadonlySet<string>, repo: string): boolean {
  const prefix = `${repo}#`
  for (const key of merging) if (key.startsWith(prefix)) return true
  return false
}

// One PR's pill is out of action while its own merge runs, and while a Merge all
// for its repo works through the queue towards it. Every other pill on the board
// stays live.
export function isPrBusy(merging: ReadonlySet<string>, repo: string, pullNumber: number): boolean {
  return merging.has(prMergeKey(repo, pullNumber)) || merging.has(prMergeKey(repo, 'all'))
}
