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
// presentational. `merging` holds a key per in-flight merge and doubles as the
// re-entrancy guard: a second click on the SAME pill is a no-op, while a click on
// any other pill starts its own merge. The 30s snapshot poll can leave a green
// pill stale, so failures are normal and surface inline via `errors` rather than
// throwing.
export function usePrMerge(): PrMerge {
  const { apiBase, mergeFetcher } = useCiConfig()
  const queryClient = useQueryClient()
  const [merging, setMerging] = useState<ReadonlySet<string>>(() => new Set())
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [merged, setMerged] = useState<ReadonlySet<string>>(() => new Set())
  const [receipts, setReceipts] = useState<ReadonlySet<string>>(() => new Set())
  const receiptTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
  // The guard reads from a ref, not from `merging`: two clicks in the same tick
  // would both see the pre-render state and both start the same merge.
  const inFlight = useRef(new Set<string>())

  useEffect(() => () => {
    for (const timer of receiptTimers.current) clearTimeout(timer)
  }, [])

  const startMerge = useCallback((key: string) => {
    if (inFlight.current.has(key)) return false
    inFlight.current.add(key)
    setMerging(current => new Set(current).add(key))
    return true
  }, [])

  const endMerge = useCallback((key: string) => {
    inFlight.current.delete(key)
    setMerging(current => {
      const next = new Set(current)
      next.delete(key)
      return next
    })
  }, [])

  const dismissError = useCallback((repo: string) => {
    setErrors(current => {
      if (!current.has(repo)) return current
      const next = new Map(current)
      next.delete(repo)
      return next
    })
  }, [])

  const setRepoError = useCallback((repo: string, message: string) => {
    setErrors(current => new Map(current).set(repo, message))
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
      const key = prMergeKey(repo, pullNumber)
      if (!startMerge(key)) return
      dismissError(repo)
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
          setRepoError(repo, result.message)
        }
      } finally {
        endMerge(key)
      }
    },
    [startMerge, endMerge, dismissError, setRepoError, callMerge, markMerged, refresh],
  )

  const mergeAll = useCallback(
    async (repo: string, pullNumbers: number[]) => {
      const allKey = prMergeKey(repo, 'all')
      if (!startMerge(allKey)) return
      dismissError(repo)
      let merged = 0
      try {
        for (const n of pullNumbers) {
          // The PR being merged carries its own key too, so its pill reads
          // "Merging…" as the queue reaches it rather than just going flat.
          const key = prMergeKey(repo, n)
          startMerge(key)
          let result: MergeResult
          try {
            result = await callMerge(repo, n)
          } finally {
            endMerge(key)
          }
          if (!result.ok) {
            setRepoError(repo, `Merged ${merged} of ${pullNumbers.length}; failed on #${n}: ${result.message}`)
            break
          }
          merged += 1
          markMerged(repo, n)
        }
        if (merged > 0) await refresh()
      } finally {
        endMerge(allKey)
      }
    },
    [startMerge, endMerge, dismissError, setRepoError, callMerge, markMerged, refresh],
  )

  return { merging, merged, receipts, errors, mergeOne, mergeAll, dismissError }
}
