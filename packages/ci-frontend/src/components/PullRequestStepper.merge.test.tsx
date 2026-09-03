import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { CiConfigProvider } from '../CiConfigContext'
import { usePrMerge } from '../hooks/usePrMerge'
import { PullRequestStepper } from './PullRequestStepper'
import type { OpenPr } from '../lib/flattenOpenPrs'
import type { MergeResult } from '../api/mergePullRequest'

const openPr: OpenPr = {
  number: 7, title: 'Add widget', author: 'octocat',
  htmlUrl: 'https://github.com/x/y/pull/7', isDraft: false,
  createdAt: '2026-05-30T00:00:00Z', readyToMerge: true, repo: 'repo-a',
}

// The component is presentational now; merge state comes from the page-level
// hook, so the test harness wires it the same way CiBoardContent does.
function Harness({ prs, admin }: { prs: OpenPr[]; admin: boolean }) {
  const merge = usePrMerge()
  return <PullRequestStepper prs={prs} onClose={() => {}} isAdmin={admin} merge={merge} />
}

function wrapperWith(mergeFetcher: (repo: string, n: number) => Promise<MergeResult>) {
  const queryClient = new QueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CiConfigProvider value={{ apiBase: '', mergeFetcher }}>
        {children}
      </CiConfigProvider>
    </QueryClientProvider>
  )
}

function renderStepper(mergeFetcher: (repo: string, n: number) => Promise<MergeResult>, admin: boolean) {
  return render(<Harness prs={[openPr]} admin={admin} />, { wrapper: wrapperWith(mergeFetcher) })
}

test('admin merges the displayed PR from the stepper', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: true, sha: 'abc' } satisfies MergeResult)
  renderStepper(mergeFetcher, true)
  const mergePill = screen.getByRole('button', { name: /rebase-merge/i })
  await userEvent.click(mergePill) // arm
  await userEvent.click(mergePill) // confirm
  expect(mergeFetcher).toHaveBeenCalledWith('repo-a', 7)
})

test('guest sees a display-only pill in the stepper', () => {
  const { container } = renderStepper(vi.fn(), false)
  expect(container.querySelector('.chip--ready')?.tagName).toBe('SPAN')
})

test('stepper shows the merge failure inline', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  renderStepper(mergeFetcher, true)
  const mergePill = screen.getByRole('button', { name: /rebase-merge/i })
  await userEvent.click(mergePill) // arm
  await userEvent.click(mergePill) // confirm
  expect(await screen.findByRole('alert')).toHaveTextContent('not mergeable')
})

test('paging to another PR drops the previous PR\'s merge error', async () => {
  const prs: OpenPr[] = [
    openPr,
    { ...openPr, number: 8, title: 'Add sprocket', repo: 'repo-b' },
  ]
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  render(<Harness prs={prs} admin={true} />, { wrapper: wrapperWith(mergeFetcher) })
  const mergePill = screen.getByRole('button', { name: /rebase-merge/i })
  await userEvent.click(mergePill) // arm
  await userEvent.click(mergePill) // confirm
  expect(await screen.findByRole('alert')).toHaveTextContent('not mergeable')
  await userEvent.keyboard('{ArrowRight}')
  expect(screen.getByText('2 / 2')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a merge error from another repo does not bleed into the displayed PR', async () => {
  const prs: OpenPr[] = [
    openPr, // repo-a #7, displayed
    { ...openPr, number: 8, title: 'Add sprocket', repo: 'repo-b' },
  ]
  const mergeRef: { current: ReturnType<typeof usePrMerge> | null } = { current: null }
  function CaptureHarness() {
    const merge = usePrMerge()
    // Publish via an effect: React Compiler forbids mutating outer-scope values
    // during render, and effects run before the test's awaited assertions.
    useEffect(() => { mergeRef.current = merge })
    return <PullRequestStepper prs={prs} onClose={() => {}} isAdmin merge={merge} />
  }
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  render(<CaptureHarness />, { wrapper: wrapperWith(mergeFetcher) })
  // Fail a merge on repo-b while the stepper shows repo-a's PR.
  await act(() => mergeRef.current!.mergeOne('repo-b', 8))
  expect(mergeRef.current!.errors.get('repo-b')).toBe('not mergeable')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  // And the alert does appear once the failing repo's PR is displayed... but
  // paging dismisses stale errors, so instead verify repo-a's own failure shows.
  await act(async () => mergeRef.current!.dismissError('repo-b'))
  const mergePill = screen.getByRole('button', { name: /rebase-merge/i })
  await userEvent.click(mergePill) // arm
  await userEvent.click(mergePill) // confirm
  expect(await screen.findByRole('alert')).toHaveTextContent('not mergeable')
})
test('opening the stepper keeps an error already recorded for the shown PR\'s repo', async () => {
  const mergeRef: { current: ReturnType<typeof usePrMerge> | null } = { current: null }
  function LateOpenHarness({ open }: { open: boolean }) {
    const merge = usePrMerge()
    useEffect(() => { mergeRef.current = merge })
    if (!open) return null
    return <PullRequestStepper prs={[openPr]} onClose={() => {}} isAdmin merge={merge} />
  }
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  const { rerender } = render(<LateOpenHarness open={false} />, { wrapper: wrapperWith(mergeFetcher) })
  // Fail repo-a's merge from the board, then open the stepper on that PR: the
  // paging effect's mount run must not swallow the error it lands on.
  await act(() => mergeRef.current!.mergeOne('repo-a', 7))
  rerender(<LateOpenHarness open={true} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('not mergeable')
})
