import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PullRequestList } from './PullRequestList'
import type { PullRequest } from '../api/types'

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
