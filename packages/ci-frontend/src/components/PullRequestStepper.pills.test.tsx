import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PullRequestStepper } from './PullRequestStepper'
import type { OpenPr } from '../lib/flattenOpenPrs'

const base: OpenPr = {
  repo: 'fixportal-engine',
  number: 181,
  title: 'Add FIX decoder panel',
  author: 'chris',
  htmlUrl: 'https://github.com/x/y/pull/181',
  isDraft: false,
  createdAt: '2026-07-29T00:00:00Z',
}

test('renders the review pills for a PR that carries signals', () => {
  const pr: OpenPr = {
    ...base,
    reviewSignals: [
      { name: 'CodeRabbit', state: 'outstanding', count: 3 },
      { name: 'Gitar', state: 'clean' },
    ],
  }
  render(<PullRequestStepper prs={[pr]} onClose={() => {}} />)
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
  expect(screen.getByText('CodeRabbit: 3 outstanding')).toBeInTheDocument()
  expect(screen.getByText('Gitar: clean')).toBeInTheDocument()
})

test('renders no pill row for a PR with no signals', () => {
  const { container } = render(<PullRequestStepper prs={[base]} onClose={() => {}} />)
  expect(container.querySelector('.review-pills')).toBeNull()
})

test('swaps the pills when paging to the next PR', () => {
  const first: OpenPr = { ...base, reviewSignals: [{ name: 'CodeRabbit', state: 'clean' }] }
  const second: OpenPr = { ...base, number: 182, createdAt: '2026-07-30T00:00:00Z', reviewSignals: [{ name: 'Gitar', state: 'pending' }] }
  render(<PullRequestStepper prs={[first, second]} onClose={() => {}} />)
  expect(screen.getByText('CodeRabbit: clean')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Next/ }))
  expect(screen.queryByText('CodeRabbit: clean')).toBeNull()
  expect(screen.getByText('Gitar: not yet reviewed')).toBeInTheDocument()
})
