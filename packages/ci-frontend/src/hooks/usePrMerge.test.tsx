import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { CiConfigProvider } from '../CiConfigContext'
import { usePrMerge } from './usePrMerge'
import type { MergeResult } from '../api/mergePullRequest'

function wrapperWith(mergeFetcher: (repo: string, n: number) => Promise<MergeResult>) {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CiConfigProvider value={{ apiBase: '', mergeFetcher }}>{children}</CiConfigProvider>
    </QueryClientProvider>
  )
  return { wrapper, invalidateSpy }
}

const ok: MergeResult = { ok: true, sha: 'abc' }

test('mergeOne merges via the configured fetcher and invalidates the snapshot query', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue(ok)
  const { wrapper, invalidateSpy } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge('repo-a'), { wrapper })
  await act(() => result.current.mergeOne(7))
  expect(mergeFetcher).toHaveBeenCalledWith('repo-a', 7)
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-snapshot'] })
  expect(result.current.merging).toBeNull()
  expect(result.current.error).toBeNull()
})

test('mergeOne surfaces a failure message and does not invalidate', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'Pull request is not mergeable' } satisfies MergeResult)
  const { wrapper, invalidateSpy } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge('repo-a'), { wrapper })
  await act(() => result.current.mergeOne(7))
  expect(result.current.error).toBe('Pull request is not mergeable')
  expect(result.current.merging).toBeNull()
  expect(invalidateSpy).not.toHaveBeenCalled()
  act(() => result.current.dismissError())
  expect(result.current.error).toBeNull()
})

test('mergeAll merges in order and invalidates once', async () => {
  const calls: number[] = []
  const mergeFetcher = vi.fn().mockImplementation(async (_repo: string, n: number) => { calls.push(n); return ok })
  const { wrapper, invalidateSpy } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge('repo-a'), { wrapper })
  await act(() => result.current.mergeAll([3, 1, 2]))
  expect(calls).toEqual([3, 1, 2])
  expect(result.current.error).toBeNull()
  expect(invalidateSpy).toHaveBeenCalledTimes(1)
})

test('mergeAll stops on the first failure and reports progress', async () => {
  const mergeFetcher = vi.fn()
    .mockResolvedValueOnce(ok)
    .mockResolvedValueOnce({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  const { wrapper, invalidateSpy } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge('repo-a'), { wrapper })
  await act(() => result.current.mergeAll([3, 9, 4]))
  expect(mergeFetcher).toHaveBeenCalledTimes(2) // #4 never attempted
  expect(result.current.error).toBe('Merged 1 of 3; failed on #9: not mergeable')
  expect(invalidateSpy).toHaveBeenCalledTimes(1) // the one success still refreshes
})
