import { memo } from 'react'
import type { WorkflowSnapshot } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'
import { stateLabel } from '../lib/stateLabel'

function meta(wf: WorkflowSnapshot): string {
  // Unknown carries no trustworthy run time, so say why rather than show a
  // misleading age; known states show how long ago the run last updated.
  if (wf.state === 'unknown') return wf.lastRun ? 'no status' : 'no runs'
  return formatRelativeTime(wf.lastRun!.updatedAt)
}

// Memoised: on a no-change poll tick React Query preserves the workflow object
// reference (structural sharing), so the chip skips re-rendering.
export const SignalChip = memo(function SignalChip({ workflow }: { workflow: WorkflowSnapshot }) {
  const url = workflow.lastRun?.htmlUrl
  const linkable = Boolean(url)
  const className = `chip chip--${workflow.state}${linkable ? '' : ' chip--static'}`
  const body = (
    <>
      <span className="chip__dot" aria-hidden="true" />
      <span className="chip__label">{workflow.name}</span>
      {/* State in words for SR / colour-blind users — the dot is colour+shape only. */}
      <span className="sr-only">{stateLabel(workflow.state)}</span>
      <span className="chip__meta">{meta(workflow)}</span>
    </>
  )
  // Open the run in a new tab so the always-on board never navigates away.
  return linkable ? (
    <a className={className} href={url} title={stateLabel(workflow.state)} target="_blank" rel="noopener noreferrer">{body}</a>
  ) : (
    <span className={className} title={stateLabel(workflow.state)}>{body}</span>
  )
})
