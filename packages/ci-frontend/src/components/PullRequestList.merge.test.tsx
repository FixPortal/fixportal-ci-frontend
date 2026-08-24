import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { CiAdminProvider } from '../CiAdminContext'
import { CiConfigProvider } from '../CiConfigContext'
import { PullRequestList } from './PullRequestList'
import type { PullRequest } from '../api/types'
import type { MergeResult } from '../api/mergePullRequest'

const readyPr = (n: number): PullRequest => ({
  number: n, title: `PR ${n}`, author: 'octocat',
  htmlUrl: `https://github.com/x/y/pull/${n}`, isDraft: false,
  createdAt: '2026-05-30T00:00:00Z', readyToMerge: true,
})

function renderList(mergeFetcher: (repo: string, n: number) => Promise<MergeResult>, admin: boolean, prs: PullRequest[]) {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CiConfigProvider value={{ apiBase: '', mergeFetcher }}>
        <CiAdminProvider value={admin}>{children}</CiAdminProvider>
      </CiConfigProvider>
    </QueryClientProvider>
  )
  return render(<PullRequestList pullRequests={prs} repoName="repo-a" />, { wrapper })
}

test('admin can click a ready pill to merge that PR', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: true, sha: 'abc' } satisfies MergeResult)
  renderList(mergeFetcher, true, [readyPr(7)])
  await userEvent.click(screen.getByRole('button', { name: /Ready to merge/ }))
  expect(mergeFetcher).toHaveBeenCalledWith('repo-a', 7)
})

test('guest sees the pill but no button and no Merge all', () => {
  const mergeFetcher = vi.fn()
  const { container } = renderList(mergeFetcher, false, [readyPr(7), readyPr(8)])
  expect(container.querySelector('button')).toBeNull()
  expect(screen.getAllByText('Ready to merge')).toHaveLength(2) // display-only pills still render
  expect(screen.queryByRole('button', { name: /Merge all/i })).toBeNull()
})

test('Merge all merges every ready PR in listed order', async () => {
  const calls: number[] = []
  const mergeFetcher = vi.fn().mockImplementation(async (_r: string, n: number) => { calls.push(n); return { ok: true, sha: 'x' } satisfies MergeResult })
  renderList(mergeFetcher, true, [readyPr(3), { ...readyPr(9), readyToMerge: false }, readyPr(4)])
  await userEvent.click(screen.getByRole('button', { name: /Merge all/i }))
  await screen.findByRole('button', { name: /Merge all/i }) // wait for re-render
  expect(calls).toEqual([3, 4]) // the not-ready PR is skipped
})

test('Merge all button is hidden when fewer than two PRs are ready', () => {
  renderList(vi.fn(), true, [readyPr(7), { ...readyPr(8), readyToMerge: false }])
  expect(screen.queryByRole('button', { name: /Merge all/i })).toBeNull()
})

test('shows a dismissible inline error when a merge fails', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  renderList(mergeFetcher, true, [readyPr(7)])
  await userEvent.click(screen.getByRole('button', { name: /Ready to merge/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('not mergeable')
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.queryByRole('alert')).toBeNull()
})
