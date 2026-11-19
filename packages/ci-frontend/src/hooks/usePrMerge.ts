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

function mergeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : 'Merge failed'
}

// Merge state for the whole board, hoisted to the page so components stay
// presentational. `merging` holds a key per in-flight merge and doubles as the
// re-entrancy guard: a second click on the SAME pill is a no-op, while a click on
// any other pill starts its own merge. The 30s snapshot poll can leave a green
// pill stale, so failures are normal and surface inline via `errors` rather than
// throwing.
export function usePrMerge(snapshotOrg?: string): PrMerge {
  const { apiBase, mergeFetcher } = useCiConfig()
  const queryClient = useQueryClient()
  const [merging, setMerging] = useState<ReadonlySet<string>>(() => new Set())
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [merged, setMerged] = useState<ReadonlySet<string>>(() => new Set())
  const [receipts, setReceipts] = useState<ReadonlySet<string>>(() => new Set())
  const receiptTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
  // The last org the snapshot named. A briefly absent snapshot (204, null fetcher,
  // recreated fetcher) leaves it alone, so only a real org-to-org change resets.
  const currentOrg = useRef(snapshotOrg)
  const sourceGeneration = useRef(0)
  // The guard reads from a ref, not from `merging`: two clicks in the same tick
  // would both see the pre-render state and both start the same merge. Guard ids
  // are qualified by org and released only by the request that took them, so an
  // org reset never frees a POST that is still on the wire.
  const inFlight = useRef(new Set<string>())

  useEffect(
    () => () => {
      for (const timer of receiptTimers.current) clearTimeout(timer)
    },
    [],
  )

  useEffect(() => {
    if (snapshotOrg === undefined) return
    const previous = currentOrg.current
    currentOrg.current = snapshotOrg
    if (previous === undefined || previous === snapshotOrg) return
    sourceGeneration.current += 1
    for (const timer of receiptTimers.current) clearTimeout(timer)
    receiptTimers.current.clear()
    setMerging(new Set())
    setMerged(new Set())
    setReceipts(new Set())
    setErrors(new Map())
  }, [snapshotOrg])

  const isInFlight = useCallback(
    (key: string) => inFlight.current.has(`${currentOrg.current ?? ''}|${key}`),
    [],
  )

  // Returns the guard id to hand back to endMerge, or null when the key is taken.
  const startMerge = useCallback((key: string) => {
    const guard = `${currentOrg.current ?? ''}|${key}`
    if (inFlight.current.has(guard)) return null
    inFlight.current.add(guard)
    setMerging((current) => new Set(current).add(key))
    return guard
  }, [])

  const endMerge = useCallback((key: string, guard: string, generation: number) => {
    inFlight.current.delete(guard)
    if (generation !== sourceGeneration.current) return
    setMerging((current) => {
      const next = new Set(current)
      next.delete(key)
      return next
    })
  }, [])

  const dismissError = useCallback((repo: string) => {
    setErrors((current) => {
      if (!current.has(repo)) return current
      const next = new Map(current)
      next.delete(repo)
      return next
    })
  }, [])

  const setRepoError = useCallback((repo: string, message: string) => {
    setErrors((current) => new Map(current).set(repo, message))
  }, [])

  const markMerged = useCallback((repo: string, pullNumber: number) => {
    const key = prMergeKey(repo, pullNumber)
    setMerged((current) => {
      const next = new Set(current).add(key)
      // ponytail: cap merged keys; prune against snapshots if 1,000 merges between polls becomes realistic.
      if (next.size > MAX_MERGED_KEYS) {
        const oldest = next.values().next().value
        if (oldest !== undefined) next.delete(oldest)
      }
      return next
    })
    setReceipts((current) => new Set(current).add(key))
    const timer = setTimeout(() => {
      setReceipts((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      receiptTimers.current.delete(timer)
    }, MERGE_RECEIPT_MS)
    receiptTimers.current.add(timer)
  }, [])

  const callMerge = useCallback(
    (repo: string, pullNumber: number, headSha: string): Promise<MergeResult> => {
      if (mergeFetcher) return mergeFetcher(repo, pullNumber, headSha)
      const mergeUrl = `${apiBase.replace(/\/$/, '')}/api/dashboard/merge`
      return mergePullRequest(mergeUrl, repo, pullNumber, headSha)
    },
    [apiBase, mergeFetcher],
  )

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['dashboard-snapshot'] }),
    [queryClient],
  )

  const mergeOne = useCallback(
    async (repo: string, pullNumber: number, headSha: string) => {
      const key = prMergeKey(repo, pullNumber)
      const generation = sourceGeneration.current
      const guard = startMerge(key)
      if (guard === null) return
      dismissError(repo)
      try {
        let result: MergeResult
        try {
          result = await callMerge(repo, pullNumber, headSha)
        } catch (error) {
          if (generation !== sourceGeneration.current) return
          setRepoError(repo, mergeErrorMessage(error))
          return
        }
        if (generation !== sourceGeneration.current) return
        if (result.ok) {
          markMerged(repo, pullNumber)
          await refresh()
        } else {
          // A failed merge (typically a 409: the PR went stale since the last
          // poll) means our snapshot is out of date — refresh before surfacing
          // the error so the board catches up.
          await refresh()
          if (generation !== sourceGeneration.current) return
          setRepoError(repo, result.message)
        }
      } finally {
        endMerge(key, guard, generation)
      }
    },
    [startMerge, endMerge, dismissError, setRepoError, callMerge, markMerged, refresh],
  )

  const mergeAll = useCallback(
    async (repo: string, prs: readonly { number: number; headSha: string }[]) => {
      const allKey = prMergeKey(repo, 'all')
      const generation = sourceGeneration.current
      const allGuard = startMerge(allKey)
      if (allGuard === null) return
      dismissError(repo)
      let merged = 0
      // Excludes PRs another entry point already owns, whether taken before this
      // call or while it runs, so the reported total only counts PRs this call
      // attempted or will attempt.
      const queue = prs.filter(({ number: n }) => !isInFlight(prMergeKey(repo, n)))
      let attempted = queue.length
      try {
        for (const [index, { number: n, headSha }] of queue.entries()) {
          // The PR being merged carries its own key too, so its pill reads
          // "Merging…" as the queue reaches it rather than just going flat.
          const key = prMergeKey(repo, n)
          // A PR already merging through another entry point (e.g. mergeOne) is
          // left alone rather than issuing a second backend request for it.
          const guard = startMerge(key)
          if (guard === null) {
            attempted -= 1
            continue
          }
          let result: MergeResult
          try {
            result = await callMerge(repo, n, headSha)
          } catch (error) {
            result = { ok: false, status: null, message: mergeErrorMessage(error) }
          } finally {
            endMerge(key, guard, generation)
          }
          if (generation !== sourceGeneration.current) return
          if (!result.ok) {
            // A later PR may have been taken by another entry point while this one
            // was in flight; the loop breaks before its guard could exclude it.
            const takenSince = queue
              .slice(index + 1)
              .filter((pr) => isInFlight(prMergeKey(repo, pr.number))).length
            setRepoError(
              repo,
              `Merged ${merged} of ${attempted - takenSince}; failed on #${n}: ${result.message}`,
            )
            break
          }
          merged += 1
          markMerged(repo, n)
        }
        if (generation === sourceGeneration.current) await refresh()
      } finally {
        endMerge(allKey, allGuard, generation)
      }
    },
    [startMerge, endMerge, isInFlight, dismissError, setRepoError, callMerge, markMerged, refresh],
  )

  return { merging, merged, receipts, errors, mergeOne, mergeAll, dismissError }
}
