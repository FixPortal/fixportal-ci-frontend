import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ReadyToMergePill } from './ReadyToMergePill'
import { ARM_TIMEOUT_MS } from './useArmedAction'

test('renders a display-only span when no onMerge handler is given', () => {
  const { container } = render(<ReadyToMergePill ready />)
  expect(container.querySelector('button')).toBeNull()
  expect(container.querySelector('span.chip--ready')).not.toBeNull()
  expect(screen.getByTitle('Ready to merge')).toBeInTheDocument()
})

test('shows a merged receipt to display-only viewers', () => {
  render(<ReadyToMergePill ready={false} merged />)
  expect(screen.getByTitle('Merge completed')).toHaveTextContent('✓ Merged')
})

test('arms on the first click rather than merging', async () => {
  const onMerge = vi.fn()
  render(<ReadyToMergePill ready onMerge={onMerge} />)
  await userEvent.click(screen.getByRole('button', { name: 'Rebase-merge pull request' }))
  expect(onMerge).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Confirm rebase-merge of pull request' }))
    .toHaveTextContent('Confirm merge')
})

test('merges on the confirming second click', async () => {
  const onMerge = vi.fn()
  render(<ReadyToMergePill ready onMerge={onMerge} />)
  const pill = screen.getByRole('button')
  await userEvent.click(pill)
  await userEvent.click(pill)
  expect(onMerge).toHaveBeenCalledTimes(1)
  // Back to the resting label: a third click has to arm again.
  expect(pill).toHaveTextContent('Ready to merge')
})

test('stands down when focus leaves an armed pill', async () => {
  const onMerge = vi.fn()
  render(
    <>
      <ReadyToMergePill ready onMerge={onMerge} />
      <button type="button">elsewhere</button>
    </>,
  )
  const pill = screen.getByRole('button', { name: /rebase-merge/i })
  await userEvent.click(pill)
  await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }))
  expect(pill).toHaveTextContent('Ready to merge')
  await userEvent.click(pill)
  expect(onMerge).not.toHaveBeenCalled()
})

test('stands down on its own after the arming window', () => {
  vi.useFakeTimers()
  try {
    const onMerge = vi.fn()
    render(<ReadyToMergePill ready onMerge={onMerge} />)
    const pill = screen.getByRole('button')
    // fireEvent, not userEvent: userEvent's own internal delays deadlock against
    // fake timers, and the click itself is all this test needs.
    fireEvent.click(pill)
    expect(pill).toHaveTextContent('Confirm merge')
    act(() => { vi.advanceTimersByTime(ARM_TIMEOUT_MS) })
    expect(pill).toHaveTextContent('Ready to merge')
    fireEvent.click(pill)
    expect(onMerge).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
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
