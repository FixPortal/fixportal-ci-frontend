import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PullRequestStepper } from './PullRequestStepper'
import type { OpenPr } from '../lib/flattenOpenPrs'

const prs: OpenPr[] = [
  { repo: 'x/y', number: 7, title: 'Add widget', author: 'octocat', htmlUrl: 'https://github.com/x/y/pull/7', isDraft: false, createdAt: '2026-05-30T00:00:00Z' },
]

test('always shows the "Open on GitHub" link', () => {
  render(<PullRequestStepper prs={prs} onClose={() => {}} />)
  const link = screen.getByRole('link', { name: /Open on GitHub/ })
  expect(link).toHaveAttribute('href', 'https://github.com/x/y/pull/7')
})

test('hides the prev/next nav when there is a single PR', () => {
  render(<PullRequestStepper prs={prs} onClose={() => {}} />)
  expect(screen.getByText('1 / 1')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /next/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /prev/i })).toBeNull()
})
