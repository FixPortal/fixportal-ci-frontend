import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { CiConfigProvider } from '../CiConfigContext'
import { usePrMerge } from '../hooks/usePrMerge'
import { PullRequestList } from './PullRequestList'
import type { PullRequest } from '../api/types'
import type { MergeResult } from '../api/mergePullRequest'

const readyPr = (n: number): PullRequest => ({
  number: n, title: `PR ${n}`, author: 'octocat',
  htmlUrl: `https://github.com/x/y/pull/${n}`, isDraft: false,
  createdAt: '2026-05-30T00:00:00Z', readyToMerge: true,
})

// The component is presentational now; merge state comes from the page-level
// hook, so the test harness wires it the same way CiBoardContent does.
function Harness({ prs, admin }: { prs: PullRequest[]; admin: boolean }) {
  const merge = usePrMerge()
  return <PullRequestList pullRequests={prs} repoName="repo-a" isAdmin={admin} merge={merge} />
}

function renderList(mergeFetcher: (repo: string, n: number) => Promise<MergeResult>, admin: boolean, prs: PullRequest[]) {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CiConfigProvider value={{ apiBase: '', mergeFetcher }}>
        {children}
      </CiConfigProvider>
    </QueryClientProvider>
  )
  return render(<Harness prs={prs} admin={admin} />, { wrapper })
}

test('admin can click a ready pill to merge that PR', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: true, sha: 'abc' } satisfies MergeResult)
  renderList(mergeFetcher, true, [readyPr(7)])
  await userEvent.click(screen.getByRole('button', { name: /rebase-merge/i }))
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
  await screen.findByRole('button', { name: 'Merged PR #4' })
  expect(calls).toEqual([3, 4]) // the not-ready PR is skipped
})

test('Merge all button is hidden when fewer than two PRs are ready', () => {
  renderList(vi.fn(), true, [readyPr(7), { ...readyPr(8), readyToMerge: false }])
  expect(screen.queryByRole('button', { name: /Merge all/i })).toBeNull()
})

test('shows a dismissible inline error when a merge fails', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  renderList(mergeFetcher, true, [readyPr(7)])
  await userEvent.click(screen.getByRole('button', { name: /rebase-merge/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('not mergeable')
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.queryByRole('alert')).toBeNull()
})

// Two-repo harness sharing one page-level merge state, like CiBoardContent.
function TwoRepoHarness() {
  const merge = usePrMerge()
  return (
    <>
      <PullRequestList pullRequests={[readyPr(7)]} repoName="repo-a" isAdmin merge={merge} />
      <PullRequestList pullRequests={[readyPr(8)]} repoName="repo-b" isAdmin merge={merge} />
    </>
  )
}

function renderTwoRepos(mergeFetcher: (repo: string, n: number) => Promise<MergeResult>) {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CiConfigProvider value={{ apiBase: '', mergeFetcher }}>
        {children}
      </CiConfigProvider>
    </QueryClientProvider>
  )
  return render(<TwoRepoHarness />, { wrapper })
}

test('a merge error renders only in the failing repo, not board-wide', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  const { container } = renderTwoRepos(mergeFetcher)
  // Merge repo-b's PR; the alert must land in repo-b's section only.
  const repoBSection = container.querySelectorAll('.repo-prs')[1]
  await userEvent.click(within(repoBSection as HTMLElement).getByRole('button', { name: /rebase-merge/i }))
  const alerts = await screen.findAllByRole('alert')
  expect(alerts).toHaveLength(1)
  expect(alerts[0]).toHaveTextContent('not mergeable')
  expect(repoBSection.contains(alerts[0])).toBe(true)
})

test('an in-flight merge in one repo disables the other repo\'s pills', async () => {
  let resolveMerge!: (r: MergeResult) => void
  const mergeFetcher = vi.fn().mockImplementation(() => new Promise<MergeResult>(res => { resolveMerge = res }))
  const { container } = renderTwoRepos(mergeFetcher)
  const [repoASection, repoBSection] = container.querySelectorAll('.repo-prs')
  const pillA = within(repoASection as HTMLElement).getByRole('button', { name: /rebase-merge/i })
  const pillB = within(repoBSection as HTMLElement).getByRole('button', { name: /rebase-merge/i })
  expect(pillB).toBeEnabled()
  await userEvent.click(pillA)
  // The hook's re-entrancy guard is global, so busy is global too: no pill may
  // look clickable while its click would be swallowed.
  expect(pillA).toBeDisabled()
  expect(pillB).toBeDisabled()
  resolveMerge({ ok: true, sha: 'abc' })
  await within(repoBSection as HTMLElement).findByRole('button', { name: /rebase-merge/i })
})
