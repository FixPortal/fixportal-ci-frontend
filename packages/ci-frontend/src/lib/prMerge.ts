// Merge state handed from the page (usePrMerge) down to presentational
// components as props. The interface lives in lib — not hooks — so components
// can reference the type without an import edge into the hooks layer (the
// architecture spec counts type-only imports as dependencies).
export interface PrMerge {
  merging: { repo: string; pr: number | 'all' } | null
  // Confirmed merges stay here for the session so a stale sweep snapshot cannot
  // put their cards back. receipts is the brief visible success acknowledgement.
  merged: ReadonlySet<string>
  receipts: ReadonlySet<string>
  // Scoped: a merge error belongs to the repo it failed in, so one failure
  // doesn't paint the same alert across every repo section on the board.
  error: { repo: string; message: string } | null
  mergeOne: (repo: string, pullNumber: number) => Promise<void>
  mergeAll: (repo: string, pullNumbers: number[]) => Promise<void>
  dismissError: () => void
}

export function prMergeKey(repo: string, pullNumber: number): string {
  return `${repo}#${pullNumber}`
}
