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

test('shows the count only on an outstanding signal', () => {
  render(<ReviewPills signals={signals} />)
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.queryByText('0')).toBeNull()
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

test('degrades to a static span when the url is rejected by the sanitizer', () => {
  render(<ReviewPills signals={[{ name: 'CodeRabbit', state: 'outstanding', count: 1, htmlUrl: 'javascript:alert(1)' }]} />)
  expect(screen.queryByRole('link')).toBeNull()
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
