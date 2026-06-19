import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { PullRequestStepper } from './PullRequestStepper'
import type { OpenPr } from '../lib/flattenOpenPrs'

function pr(n: number): OpenPr {
  return {
    repo: 'x/y',
    number: n,
    title: `PR ${n}`,
    author: 'octocat',
    htmlUrl: `https://github.com/x/y/pull/${n}`,
    isDraft: false,
    createdAt: '2026-05-30T00:00:00Z',
  }
}

const three = [pr(1), pr(2), pr(3)]

test('clamps the index when a background refresh shrinks the list while open', () => {
  const onClose = vi.fn()
  const { rerender } = render(<PullRequestStepper prs={three} onClose={onClose} />)

  // Step to the last PR (index 2).
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  expect(screen.getByText('3 / 3')).toBeInTheDocument()

  // The list shrinks under us (the viewed PR merged). The stale index must clamp
  // to the new tail rather than reading undefined and unmounting silently.
  rerender(<PullRequestStepper prs={[pr(1), pr(2)]} onClose={onClose} />)
  expect(screen.getByText('2 / 2')).toBeInTheDocument()
  expect(screen.getByText('PR 2')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('closes via the callback when the list drains entirely', () => {
  const onClose = vi.fn()
  const { rerender } = render(<PullRequestStepper prs={three} onClose={onClose} />)

  rerender(<PullRequestStepper prs={[]} onClose={onClose} />)
  expect(onClose).toHaveBeenCalledTimes(1)
})
