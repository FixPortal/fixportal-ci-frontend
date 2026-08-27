import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ReadyToMergePill } from './ReadyToMergePill'

test('renders a display-only span when no onMerge handler is given', () => {
  const { container } = render(<ReadyToMergePill ready />)
  expect(container.querySelector('button')).toBeNull()
  expect(container.querySelector('span.chip--ready')).not.toBeNull()
})

test('renders a button that fires onMerge when clicked', async () => {
  const onMerge = vi.fn()
  render(<ReadyToMergePill ready onMerge={onMerge} />)
  await userEvent.click(screen.getByRole('button', { name: /rebase-merge/i }))
  expect(onMerge).toHaveBeenCalledTimes(1)
})

test('disables the button while busy', () => {
  render(<ReadyToMergePill ready onMerge={() => {}} busy />)
  expect(screen.getByRole('button', { name: /rebase-merge/i })).toBeDisabled()
})

test('names the in-flight state instead of looking ready again', () => {
  render(<ReadyToMergePill ready prNumber={7} onMerge={() => {}} busy merging />)
  expect(screen.getByRole('button', { name: 'Merging PR #7' })).toHaveTextContent('Merging…')
})

test.each([[false], [null], [undefined]])('renders nothing when ready is %s, even with onMerge', ready => {
  const { container } = render(<ReadyToMergePill ready={ready} onMerge={() => {}} />)
  expect(container.firstChild).toBeNull()
})

test('names the button for its PR when prNumber is given', () => {
  render(<ReadyToMergePill ready prNumber={7} onMerge={() => {}} />)
  expect(screen.getByRole('button', { name: 'Rebase-merge PR #7' })).toBeInTheDocument()
})
