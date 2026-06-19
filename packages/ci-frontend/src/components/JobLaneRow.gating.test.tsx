import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { JobLaneRow } from './JobLaneRow'
import type { JobSignal } from '../api/types'

const signal: JobSignal = {
  workflow: 'CI', name: 'Deploy (prod)', state: 'success',
  htmlUrl: 'https://github.com/FixPortal/repo/actions/runs/1/job/2',
  updatedAt: '2026-05-30T12:00:00Z',
}

test('always links job chips to their run page', () => {
  render(<JobLaneRow kind="deploys" glyph="▲" label="Deploys" signals={[signal]} />)
  expect(screen.getByRole('link')).toHaveAttribute('href', signal.htmlUrl)
})

test('renders nothing when there are no signals', () => {
  const { container } = render(<JobLaneRow kind="deploys" glyph="▲" label="Deploys" signals={[]} />)
  expect(container.firstChild).toBeNull()
})
