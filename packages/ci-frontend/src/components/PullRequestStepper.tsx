import { useEffect, useRef, useState } from 'react'
import type { OpenPr } from '../lib/flattenOpenPrs'
import { formatRelativeTime } from '../lib/relativeTime'
import { prAgeTone } from '../lib/prAgeTone'
export function PullRequestStepper({ prs, onClose }: { prs: OpenPr[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Background CI polling can shrink `prs` while the stepper is open (e.g. the
  // PR being viewed just merged). Clamp against the live length so `pr` never
  // reads undefined — an undefined read would return null and unmount the
  // <dialog> WITHOUT firing onClose, wedging the parent's stepperOpen at true
  // and permanently breaking the Open-PRs button for the session.
  const safeIndex = Math.min(i, Math.max(0, prs.length - 1))
  const pr = prs[safeIndex]

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dlg = dialogRef.current
    dlg?.showModal()
    dlg?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  // If the list drains entirely, there is nothing to step through — close via
  // the callback so the parent resets stepperOpen, rather than silently
  // rendering null and leaving a dangling open flag.
  useEffect(() => {
    if (prs.length === 0) onClose()
  }, [prs.length, onClose])

  if (!pr) return null

  return (
    <dialog
      ref={dialogRef}
      className="pr-modal"
      aria-label="Open pull requests"
      tabIndex={-1}
      onCancel={e => { e.preventDefault(); onClose() }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      // Left/Right arrow paging, scoped to the dialog. Escape closes via the
      // native cancel event above.
      onKeyDown={e => {
        if (e.key === 'ArrowRight') setI(Math.min(safeIndex + 1, prs.length - 1))
        if (e.key === 'ArrowLeft') setI(Math.max(safeIndex - 1, 0))
      }}
    >
      <div className="pr-modal__top">
        <span className="pr-modal__title">Open pull requests</span>
        <span className="pr-modal__counter">{safeIndex + 1} / {prs.length}</span>
        <button type="button" className="pr-modal__x" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className={`pr-card pr-card--${prAgeTone(pr.createdAt)}${pr.isDraft ? ' pr-card--draft' : ''}`}>
        <div className="pr-card__head">
          <span className="pr-card__repo">{pr.repo}</span>
          <span className="pr-card__num">#{pr.number}</span>
          <span className="pr-card__meta">{formatRelativeTime(pr.createdAt)} · {pr.isDraft ? 'draft' : 'ready'}</span>
        </div>
        <div className="pr-card__title">{pr.title}</div>
        <div className="pr-card__foot">
          <span className="pr-card__author">@{pr.author}</span>
          <a className="pr-card__gh" href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a>
        </div>
      </div>
      {/* One PR needs no nav — the '1 / 1' counter already says so; two disabled
          buttons would just be dead chrome. */}
      {prs.length > 1 && (
        <div className="pr-modal__nav">
          <button type="button" onClick={() => setI(Math.max(safeIndex - 1, 0))} disabled={safeIndex === 0}>‹ Prev</button>
          <button type="button" onClick={() => setI(Math.min(safeIndex + 1, prs.length - 1))} disabled={safeIndex === prs.length - 1}>Next ›</button>
        </div>
      )}
    </dialog>
  )
}
