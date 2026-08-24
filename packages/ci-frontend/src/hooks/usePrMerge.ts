import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCiConfig } from '../CiConfigContext'
import { mergePullRequest } from '../api/mergePullRequest'
import type { MergeResult } from '../api/mergePullRequest'
import type { PrMerge } from '../lib/prMerge'

export type { PrMerge }

// Merge state for the whole board, hoisted to the page so components stay
// presentational. merging doubles as the busy flag and a re-entrancy guard: a
// second click while a merge is in flight is a no-op. The 30s snapshot poll can
// leave a green pill stale, so failures are normal and surface inline via
// `error` rather than throwing.
export function usePrMerge(): PrMerge {
  const { apiBase, mergeFetcher } = useCiConfig()
  const queryClient = useQueryClient()
  const [merging, setMerging] = useState<{ repo: string; pr: number | 'all' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const callMerge = useCallback(
    (repo: string, pullNumber: number): Promise<MergeResult> => {
      if (mergeFetcher) return mergeFetcher(repo, pullNumber)
      const mergeUrl = `${apiBase.replace(/\/$/, '')}/api/dashboard/merge`
      return mergePullRequest(mergeUrl, repo, pullNumber)
    },
    [apiBase, mergeFetcher],
  )

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['dashboard-snapshot'] }),
    [queryClient],
  )

  const mergeOne = useCallback(
    async (repo: string, pullNumber: number) => {
      if (merging !== null) return
      setMerging({ repo, pr: pullNumber })
      setError(null)
      const result = await callMerge(repo, pullNumber)
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
    async (repo: string, pullNumbers: number[]) => {
      if (merging !== null) return
      setMerging({ repo, pr: 'all' })
      setError(null)
      let merged = 0
      for (const n of pullNumbers) {
        const result = await callMerge(repo, n)
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
