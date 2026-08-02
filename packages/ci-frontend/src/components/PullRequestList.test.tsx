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

test('renders one review pill per signal on the PR row', () => {
  const reviewSignals: ReviewSignal[] = [
    { name: 'CodeRabbit', state: 'outstanding', count: 2 },
    { name: 'Gitar', state: 'clean' },
  ]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  expect(container.querySelectorAll('.review-pills .chip')).toHaveLength(2)
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
  expect(screen.getByText('Gitar')).toBeInTheDocument()
})

// The backend ships the feature off (ReviewSignals:Reviewers is empty), so the
// no-signals path is the live one until that config lands. It must render byte
// for byte what it rendered before this change.
test('renders no pills when the PR carries no review signals', () => {
  const { container } = render(<PullRequestList pullRequests={prs} />)
  expect(container.querySelector('.review-pills')).toBeNull()
})

// Pills carry their own links to a reviewer's threads or alerts. Nested inside
// the PR anchor they would be interactive content within interactive content --
// invalid HTML, and a click that resolves to whichever the browser prefers.
test('renders the pills outside the PR anchor, not nested within it', () => {
  const reviewSignals: ReviewSignal[] = [{ name: 'CodeRabbit', state: 'clean' }]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  const pills = container.querySelector('.review-pills')
  expect(pills).not.toBeNull()
  expect(pills?.closest('a')).toBeNull()
})

// The wrapper is not cosmetic: board.css hangs the right-alignment and the
// responsive wrap off .repo-prs__line, so losing it silently un-styles the row.
test('wraps the PR link and its pills in a shared line element', () => {
  const reviewSignals: ReviewSignal[] = [{ name: 'CodeRabbit', state: 'clean' }]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  const line = container.querySelector('.repo-prs__line')
  expect(line).not.toBeNull()
  expect(line?.querySelector('a')).not.toBeNull()
  expect(line?.querySelector('.review-pills')).not.toBeNull()
})
