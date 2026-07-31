import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ReviewPills } from './ReviewPills'
import type { ReviewSignal } from '../api/types'

const signals: ReviewSignal[] = [
  { name: 'CodeRabbit', state: 'outstanding', count: 3, htmlUrl: 'https://github.com/x/y/pull/7/files' },
  { name: 'Gitar', state: 'clean' },
  { name: 'CodeQL', state: 'pending' },
]

test('renders one pill per signal', () => {
  render(<ReviewPills signals={signals} />)
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
  expect(screen.getByText('Gitar')).toBeInTheDocument()
  expect(screen.getByText('CodeQL')).toBeInTheDocument()
})

test.each([[undefined], [null], [[] as ReviewSignal[]]])('renders nothing for %o', input => {
  const { container } = render(<ReviewPills signals={input} />)
  expect(container.firstChild).toBeNull()
})

test.each([[{} as unknown as ReviewSignal[]], [3 as unknown as ReviewSignal[]], ['x' as unknown as ReviewSignal[]]])(
  'renders nothing for non-array signals %o',
  input => {
    const { container } = render(<ReviewPills signals={input} />)
    expect(container.firstChild).toBeNull()
  },
)

test('shows the count only on an outstanding signal', () => {
  render(<ReviewPills signals={signals} />)
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.queryByText('0')).toBeNull()
})

test('does not show a count on a non-outstanding signal even when one is supplied', () => {
  render(
    <ReviewPills
      signals={[{ name: 'Gitar', state: 'clean', count: 5 } as ReviewSignal]}
    />,
  )
  expect(screen.queryByText('5')).toBeNull()
})

test('carries the state in words for screen readers, not colour alone', () => {
  render(<ReviewPills signals={signals} />)
  expect(screen.getByText('CodeRabbit: 3 outstanding')).toBeInTheDocument()
  expect(screen.getByText('Gitar: clean')).toBeInTheDocument()
  expect(screen.getByText('CodeQL: not yet reviewed')).toBeInTheDocument()
})

test('links an outstanding pill that has a safe url', () => {
  render(<ReviewPills signals={signals} />)
  const link = screen.getByRole('link', { name: /CodeRabbit/ })
  expect(link).toHaveAttribute('href', 'https://github.com/x/y/pull/7/files')
})

test('links a clean pill that has a safe url', () => {
  render(
    <ReviewPills signals={[{ name: 'Gitar', state: 'clean', htmlUrl: 'https://github.com/x/y/pull/7' }]} />,
  )
  const link = screen.getByRole('link', { name: /Gitar/ })
  expect(link).toHaveAttribute('href', 'https://github.com/x/y/pull/7')
})

test('degrades to a static span when the url is rejected by the sanitizer', () => {
  const { container } = render(
    <ReviewPills signals={[{ name: 'CodeRabbit', state: 'outstanding', count: 1, htmlUrl: 'javascript:alert(1)' }]} />,
  )
  expect(screen.queryByRole('link')).toBeNull()
  // A link-role check alone would also pass for a bare <a> with no href attribute;
  // assert there is no anchor element at all.
  expect(container.querySelector('a')).toBeNull()
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
})

test('never links a pending or disabled pill even when a url is supplied', () => {
  render(
    <ReviewPills
      signals={[
        { name: 'Gitar', state: 'pending', htmlUrl: 'https://github.com/x/y/pull/7' },
        { name: 'CodeRabbit', state: 'disabled', htmlUrl: 'https://github.com/x/y/pull/7' },
      ]}
    />,
  )
  expect(screen.queryByRole('link')).toBeNull()
})

test('applies a state-specific class so the four states are visually distinct', () => {
  const { container } = render(<ReviewPills signals={signals} />)
  expect(container.querySelector('.chip--review-outstanding')).not.toBeNull()
  expect(container.querySelector('.chip--review-clean')).not.toBeNull()
  expect(container.querySelector('.chip--review-pending')).not.toBeNull()
})

test('skips a malformed entry instead of throwing, and renders the valid one', () => {
  const withBadEntry = [null, { name: 'Gitar', state: 'clean' }] as ReviewSignal[]
  expect(() => render(<ReviewPills signals={withBadEntry} />)).not.toThrow()
  expect(screen.getByText('Gitar')).toBeInTheDocument()
})

test('renders nothing when every entry is malformed', () => {
  const allBad = [null, { name: 'no-state' }, 'not-an-object'] as unknown as ReviewSignal[]
  const { container } = render(<ReviewPills signals={allBad} />)
  expect(container.firstChild).toBeNull()
})
