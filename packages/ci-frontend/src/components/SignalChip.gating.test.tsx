import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SignalChip } from './SignalChip'
import type { WorkflowSnapshot } from '../api/types'

const wfWithRun: WorkflowSnapshot = {
  name: 'CI', file: 'ci.yml', state: 'success',
  lastRun: {
    status: 'completed', conclusion: 'success',
    htmlUrl: 'https://github.com/FixPortal/repo/actions/runs/1',
    title: 'CI', runNumber: 1, branch: 'main', event: 'push',
    updatedAt: '2026-05-30T12:00:00Z',
  },
}

const wfNoRun: WorkflowSnapshot = {
  name: 'CI', file: 'ci.yml', state: 'unknown', lastRun: null,
}

// A htmlUrl that is truthy but rejected by isAllowedHref (protocol-relative).
const wfRejectedUrl: WorkflowSnapshot = {
  name: 'CI', file: 'ci.yml', state: 'success',
  lastRun: { ...wfWithRun.lastRun!, htmlUrl: '//evil.example.com/path' },
}

test('links the run chip when a htmlUrl is present', () => {
  render(<SignalChip workflow={wfWithRun} />)
  expect(screen.getByRole('link')).toHaveAttribute('href', wfWithRun.lastRun!.htmlUrl)
})

test('renders a non-link chip when there is no last run', () => {
  render(<SignalChip workflow={wfNoRun} />)
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText('CI').closest('.chip')).toHaveClass('chip--static')
})

test('exposes the state in words so it is not signalled by colour alone', () => {
  render(<SignalChip workflow={wfWithRun} />)
  expect(screen.getByText('passing')).toBeInTheDocument()
})

test('renders a static chip, not a dead link, when the htmlUrl is rejected by the sanitizer', () => {
  render(<SignalChip workflow={wfRejectedUrl} />)
  // Truthy-but-rejected URL sanitizes to '#'; the chip must degrade to a static
  // span like the no-run case, not an interactive <a href="#" target="_blank">.
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText('CI').closest('.chip')).toHaveClass('chip--static')
})
