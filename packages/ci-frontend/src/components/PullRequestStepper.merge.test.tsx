import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { CiAdminProvider } from '../CiAdminContext'
import { CiConfigProvider } from '../CiConfigContext'
import { PullRequestStepper } from './PullRequestStepper'
import type { OpenPr } from '../lib/flattenOpenPrs'
import type { MergeResult } from '../api/mergePullRequest'

const openPr: OpenPr = {
  number: 7, title: 'Add widget', author: 'octocat',
  htmlUrl: 'https://github.com/x/y/pull/7', isDraft: false,
  createdAt: '2026-05-30T00:00:00Z', readyToMerge: true, repo: 'repo-a',
}

function renderStepper(mergeFetcher: (repo: string, n: number) => Promise<MergeResult>, admin: boolean) {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CiConfigProvider value={{ apiBase: '', mergeFetcher }}>
        <CiAdminProvider value={admin}>{children}</CiAdminProvider>
      </CiConfigProvider>
    </QueryClientProvider>
  )
  return render(<PullRequestStepper prs={[openPr]} onClose={() => {}} />, { wrapper })
}

test('admin merges the displayed PR from the stepper', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: true, sha: 'abc' } satisfies MergeResult)
  renderStepper(mergeFetcher, true)
  await userEvent.click(screen.getByRole('button', { name: /Ready to merge/ }))
  expect(mergeFetcher).toHaveBeenCalledWith('repo-a', 7)
})

test('guest sees a display-only pill in the stepper', () => {
  const { container } = renderStepper(vi.fn(), false)
  expect(container.querySelector('.chip--ready')?.tagName).toBe('SPAN')
})

test('stepper shows the merge failure inline', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, message: 'not mergeable' } satisfies MergeResult)
  renderStepper(mergeFetcher, true)
  await userEvent.click(screen.getByRole('button', { name: /Ready to merge/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('not mergeable')
})
