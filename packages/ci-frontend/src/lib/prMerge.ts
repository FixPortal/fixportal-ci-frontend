// Merge state handed from the page (usePrMerge) down to presentational
// components as props. The interface lives in lib — not hooks — so components
// can reference the type without an import edge into the hooks layer (the
// architecture spec counts type-only imports as dependencies).
export interface PrMerge {
  merging: { repo: string; pr: number | 'all' } | null
  error: string | null
  mergeOne: (repo: string, pullNumber: number) => Promise<void>
  mergeAll: (repo: string, pullNumbers: number[]) => Promise<void>
  dismissError: () => void
}
