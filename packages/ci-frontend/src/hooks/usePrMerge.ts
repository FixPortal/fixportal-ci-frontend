import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCiConfig } from '../CiConfigContext'
import { mergePullRequest } from '../api/mergePullRequest'
import type { MergeResult } from '../api/mergePullRequest'

export interface PrMerge {
  merging: number | 'all' | null
  error: string | null
  mergeOne: (pullNumber: number) => Promise<void>
  mergeAll: (pullNumbers: number[]) => Promise<void>
  dismissError: () => void
}

// Merge state for one repo's PR list. merging doubles as the busy flag and a
// re-entrancy guard: a second click while a merge is in flight is a no-op.
// The 30s snapshot poll can leave a green pill stale, so failures are normal
// and surface inline via `error` rather than throwing.
export function usePrMerge(repoName: string): PrMerge {
  const { apiBase, mergeFetcher } = useCiConfig()
  const queryClient = useQueryClient()
  const [merging, setMerging] = useState<number | 'all' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const callMerge = useCallback(
    (pullNumber: number): Promise<MergeResult> => {
      if (mergeFetcher) return mergeFetcher(repoName, pullNumber)
      const mergeUrl = `${apiBase.replace(/\/$/, '')}/api/dashboard/merge`
      return mergePullRequest(mergeUrl, repoName, pullNumber)
    },
    [apiBase, mergeFetcher, repoName],
  )

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['dashboard-snapshot'] }),
    [queryClient],
  )

  const mergeOne = useCallback(
    async (pullNumber: number) => {
      if (merging !== null) return
      setMerging(pullNumber)
      setError(null)
      const result = await callMerge(pullNumber)
      if (result.ok) {
        await refresh()
      } else {
        setError(result.message)
      }
      setMerging(null)
    },
    [merging, callMerge, refresh],
  )

  const mergeAll = useCallback(
    async (pullNumbers: number[]) => {
      if (merging !== null) return
      setMerging('all')
      setError(null)
      let merged = 0
      for (const n of pullNumbers) {
        const result = await callMerge(n)
        if (!result.ok) {
          setError(`Merged ${merged} of ${pullNumbers.length}; failed on #${n}: ${result.message}`)
          break
        }
        merged += 1
      }
      if (merged > 0) await refresh()
      setMerging(null)
    },
    [merging, callMerge, refresh],
  )

  const dismissError = useCallback(() => setError(null), [])

  return { merging, error, mergeOne, mergeAll, dismissError }
}
