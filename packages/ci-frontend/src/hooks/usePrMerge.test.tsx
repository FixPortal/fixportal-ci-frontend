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
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  await act(() => result.current.mergeOne('repo-a', 7))
  expect(mergeFetcher).toHaveBeenCalledWith('repo-a', 7)
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-snapshot'] })
  expect(result.current.merging.size).toBe(0)
  expect(result.current.errors.size).toBe(0)
})

test('mergeOne surfaces a scoped failure and refreshes the snapshot on 409', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'Pull request is not mergeable' } satisfies MergeResult)
  const { wrapper, invalidateSpy } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  await act(() => result.current.mergeOne('repo-a', 7))
  expect(result.current.errors.get('repo-a')).toBe('Pull request is not mergeable')
  expect(result.current.merging.size).toBe(0)
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-snapshot'] })
  act(() => result.current.dismissError('repo-a'))
  expect(result.current.errors.size).toBe(0)
})

test('mergeAll merges in order and invalidates once', async () => {
  const calls: number[] = []
  const mergeFetcher = vi.fn().mockImplementation(async (_repo: string, n: number) => { calls.push(n); return ok })
  const { wrapper, invalidateSpy } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  await act(() => result.current.mergeAll('repo-a', [3, 1, 2]))
  expect(calls).toEqual([3, 1, 2])
  expect(result.current.errors.size).toBe(0)
  expect(invalidateSpy).toHaveBeenCalledTimes(1)
})

test('mergeAll stops on the first failure and reports progress', async () => {
  const mergeFetcher = vi.fn()
    .mockResolvedValueOnce(ok)
    .mockResolvedValueOnce({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  const { wrapper, invalidateSpy } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  await act(() => result.current.mergeAll('repo-a', [3, 9, 4]))
  expect(mergeFetcher).toHaveBeenCalledTimes(2) // #4 never attempted
  expect(result.current.errors.get('repo-a')).toBe('Merged 1 of 3; failed on #9: not mergeable')
  expect(invalidateSpy).toHaveBeenCalledTimes(1) // the one success still refreshes
})

test('mergeOne releases the re-entrancy guard when the configured fetcher throws', async () => {
  let rejectMerge!: (error: Error) => void
  const { wrapper } = wrapperWith(vi.fn().mockImplementation(() => new Promise<MergeResult>((_, reject) => { rejectMerge = reject })))
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  let merge!: Promise<void>
  act(() => { merge = result.current.mergeOne('repo-a', 7) })
  expect(result.current.merging.has('repo-a#7')).toBe(true)
  const rejected = expect(merge).rejects.toThrow('network failed')
  await act(async () => {
    rejectMerge(new Error('network failed'))
    await rejected
  })
  expect(result.current.merging.size).toBe(0)
})

test('mergeAll releases the re-entrancy guard when the configured fetcher throws', async () => {
  let rejectMerge!: (error: Error) => void
  const { wrapper } = wrapperWith(vi.fn().mockImplementation(() => new Promise<MergeResult>((_, reject) => { rejectMerge = reject })))
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  let merge!: Promise<void>
  act(() => { merge = result.current.mergeAll('repo-a', [7, 8]) })
  expect(result.current.merging.has('repo-a#all')).toBe(true)
  const rejected = expect(merge).rejects.toThrow('network failed')
  await act(async () => {
    rejectMerge(new Error('network failed'))
    await rejected
  })
  expect(result.current.merging.size).toBe(0)
})

test('retains only the most recent 1,000 merged PR keys', async () => {
  const { wrapper } = wrapperWith(vi.fn().mockResolvedValue(ok))
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  await act(() => result.current.mergeAll('repo-a', Array.from({ length: 1_001 }, (_, index) => index + 1)))
  expect(result.current.merged).toHaveLength(1_000)
  expect(result.current.merged.has('repo-a#1')).toBe(false)
  expect(result.current.merged.has('repo-a#1001')).toBe(true)
})
test('two merges run concurrently and each failure keeps its own repo scope', async () => {
  const resolvers: ((result: MergeResult) => void)[] = []
  const mergeFetcher = vi.fn().mockImplementation(() => new Promise<MergeResult>(resolve => { resolvers.push(resolve) }))
  const { wrapper } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  let first!: Promise<void>
  let second!: Promise<void>
  act(() => { first = result.current.mergeOne('repo-a', 7) })
  act(() => { second = result.current.mergeOne('repo-b', 8) })
  expect(mergeFetcher).toHaveBeenCalledTimes(2)
  expect(result.current.merging.has('repo-a#7')).toBe(true)
  expect(result.current.merging.has('repo-b#8')).toBe(true)
  await act(async () => {
    resolvers[0]({ ok: false, status: 409, message: 'a is stale' })
    resolvers[1]({ ok: false, status: 409, message: 'b is stale' })
    await Promise.all([first, second])
  })
  expect(result.current.errors.get('repo-a')).toBe('a is stale')
  expect(result.current.errors.get('repo-b')).toBe('b is stale')
  expect(result.current.merging.size).toBe(0)
})
test('a repeat click on the same PR while it is merging is a no-op', async () => {
  const mergeFetcher = vi.fn().mockImplementation(() => new Promise<MergeResult>(() => {}))
  const { wrapper } = wrapperWith(mergeFetcher)
  const { result } = renderHook(() => usePrMerge(), { wrapper })
  act(() => { void result.current.mergeOne('repo-a', 7) })
  act(() => { void result.current.mergeOne('repo-a', 7) })
  expect(mergeFetcher).toHaveBeenCalledTimes(1)
})
