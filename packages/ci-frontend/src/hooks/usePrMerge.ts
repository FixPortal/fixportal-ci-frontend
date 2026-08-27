import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCiConfig } from '../CiConfigContext'
import { mergePullRequest } from '../api/mergePullRequest'
import type { MergeResult } from '../api/mergePullRequest'
import type { PrMerge } from '../lib/prMerge'
import { prMergeKey } from '../lib/prMerge'

export type { PrMerge }

const MERGE_RECEIPT_MS = 900
const MAX_MERGED_KEYS = 1_000

// Merge state for the whole board, hoisted to the page so components stay
// presentational. merging doubles as the busy flag and a re-entrancy guard: a
// second click while a merge is in flight is a no-op. The 30s snapshot poll can
// leave a green pill stale, so failures are normal and surface inline via
// `error` rather than throwing.
export function usePrMerge(): PrMerge {
  const { apiBase, mergeFetcher } = useCiConfig()
  const queryClient = useQueryClient()
  const [merging, setMerging] = useState<{ repo: string; pr: number | 'all' } | null>(null)
  const [error, setError] = useState<{ repo: string; message: string } | null>(null)
  const [merged, setMerged] = useState<ReadonlySet<string>>(() => new Set())
  const [receipts, setReceipts] = useState<ReadonlySet<string>>(() => new Set())
  const receiptTimers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => () => {
    for (const timer of receiptTimers.current) clearTimeout(timer)
  }, [])

  const markMerged = useCallback((repo: string, pullNumber: number) => {
    const key = prMergeKey(repo, pullNumber)
    setMerged(current => {
      const next = new Set(current).add(key)
      // ponytail: cap merged keys; prune against snapshots if 1,000 merges between polls becomes realistic.
      if (next.size > MAX_MERGED_KEYS) next.delete(next.values().next().value!)
      return next
    })
    setReceipts(current => new Set(current).add(key))
    const timer = setTimeout(() => {
      setReceipts(current => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      receiptTimers.current.delete(timer)
    }, MERGE_RECEIPT_MS)
    receiptTimers.current.add(timer)
  }, [])

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
      try {
        const result = await callMerge(repo, pullNumber)
        if (result.ok) {
          markMerged(repo, pullNumber)
          await refresh()
        } else {
          // A failed merge (typically a 409: the PR went stale since the last
          // poll) means our snapshot is out of date — refresh before surfacing
          // the error so the board catches up.
          await refresh()
          setError({ repo, message: result.message })
        }
      } finally {
        setMerging(null)
      }
    },
    [merging, callMerge, markMerged, refresh],
  )

  const mergeAll = useCallback(
    async (repo: string, pullNumbers: number[]) => {
      if (merging !== null) return
      setMerging({ repo, pr: 'all' })
      setError(null)
      let merged = 0
      try {
        for (const n of pullNumbers) {
          const result = await callMerge(repo, n)
          if (!result.ok) {
            setError({ repo, message: `Merged ${merged} of ${pullNumbers.length}; failed on #${n}: ${result.message}` })
            break
          }
          merged += 1
          markMerged(repo, n)
        }
        if (merged > 0) await refresh()
      } finally {
        setMerging(null)
      }
    },
    [merging, callMerge, markMerged, refresh],
  )

  const dismissError = useCallback(() => setError(null), [])

  return { merging, merged, receipts, error, mergeOne, mergeAll, dismissError }
}
