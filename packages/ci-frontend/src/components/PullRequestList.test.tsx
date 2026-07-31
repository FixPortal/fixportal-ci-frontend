import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PullRequestList } from './PullRequestList'
import type { PullRequest, ReviewSignal } from '../api/types'

const prs: PullRequest[] = [
  { number: 7, title: 'Add widget', author: 'octocat', htmlUrl: 'https://github.com/x/y/pull/7', isDraft: false, createdAt: '2026-05-30T00:00:00Z' },
]

test('always renders a GitHub link for each PR', () => {
  render(<PullRequestList pullRequests={prs} />)
  const link = screen.getByRole('link', { name: /#7\s*Add widget/ })
  expect(link).toHaveAttribute('href', 'https://github.com/x/y/pull/7')
})

test('renders nothing when there are no pull requests', () => {
  const { container } = render(<PullRequestList pullRequests={[]} />)
  expect(container.firstChild).toBeNull()
})

test('renders static text, not a dead link, when htmlUrl is rejected by the sanitizer', () => {
  const rejected: PullRequest[] = [
    { number: 9, title: 'Suspicious PR', author: 'mallory', htmlUrl: 'javascript:alert(1)', isDraft: false, createdAt: '2026-05-30T00:00:00Z' },
  ]
  render(<PullRequestList pullRequests={rejected} />)
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText('Suspicious PR')).toBeInTheDocument()
})

test('does not render review pills -- they are a stepper-only affordance', () => {
  const reviewSignals: ReviewSignal[] = [{ name: 'CodeRabbit', state: 'outstanding', count: 2 }]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  expect(container.querySelector('.review-pills')).toBeNull()
})
