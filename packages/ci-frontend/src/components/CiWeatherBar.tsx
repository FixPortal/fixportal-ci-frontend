import { useEffect, useRef, useState } from 'react'
import type { CiTrendBucket, CiTrendState, RepositorySnapshot } from '../api/types'
import { failedRunsInBucket, type FailedRun } from '../lib/failedRunsInBucket'
import { isAllowedHref } from '../lib/isAllowedHref'
import { formatRelativeTime } from '../lib/relativeTime'

// A status-page "weather" strip: one block per hourly bucket, coloured by the
// carry-forward worst-state from the backend. Colours come from CSS via the
// data-state attribute. When `repositories` is supplied, failing blocks become
// buttons that open a popover naming the failed runs in that hour.
const BLOCK_WORD: Record<CiTrendState, string> = {
  passing: 'healthy',
  failing: 'failing',
  noData: 'no data',
}

function FailedRunItem({ item }: Readonly<{ item: FailedRun }>) {
  const { repo, workflow, run } = item
  const href = isAllowedHref(run.htmlUrl)
  // "CI" is the default workflow name and says nothing; any other name is worth showing.
  const detail = [/^ci$/i.test(workflow) ? null : workflow, run.branch].filter(Boolean).join(' · ')
  const body = (
    <>
      <span className="ci-failed-popover__repo">{repo}</span>
      <span className="ci-failed-popover__detail">
        {detail}
        {detail && ' '}
        <span className="ci-failed-popover__age">{formatRelativeTime(run.updatedAt)}</span>
      </span>
    </>
  )
  return (
    <li>
      {href === '#' ? (
        <span className="ci-failed-popover__run">{body}</span>
      ) : (
        <a className="ci-failed-popover__run" href={href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      )}
    </li>
  )
}

export function CiWeatherBar({
  trend,
  repositories,
}: Readonly<{
  trend: CiTrendBucket[]
  repositories?: RepositorySnapshot[]
}>) {
  const [openStart, setOpenStart] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openStart === null) return
    const onOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenStart(null)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenStart(null)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [openStart])

  if (trend.length === 0) return null
  const failing = trend.filter((b) => b.state === 'failing').length
  const healthy = trend.filter((b) => b.state === 'passing').length
  const label = `CI health, last 24h: ${failing} failing, ${healthy} healthy`
  const interactive = repositories !== undefined
  const open = interactive ? trend.find((b) => b.bucketStart === openStart) : undefined
  const failed = open && repositories ? failedRunsInBucket(repositories, open.bucketStart) : []
  return (
    <div ref={rootRef} className="ci-weather-wrap">
      {/* A role="img" figure hides its children from assistive tech, so the
          interactive variant is a labelled group instead. */}
      <figure role={interactive ? 'group' : 'img'} className="ci-weather" aria-label={label}>
        {trend.map((b) => {
          const title = `${formatRelativeTime(b.bucketStart)} · ${BLOCK_WORD[b.state]}`
          if (interactive && b.state === 'failing') {
            return (
              <button
                key={b.bucketStart}
                type="button"
                className="ci-weather__block ci-weather__block--btn"
                data-state={b.state}
                title={`${title} — click for failed runs`}
                aria-label={`Failing ${formatRelativeTime(b.bucketStart)}: show failed runs`}
                aria-expanded={openStart === b.bucketStart}
                onClick={() => {
                  setOpenStart((cur) => (cur === b.bucketStart ? null : b.bucketStart))
                }}
              />
            )
          }
          return (
            <span
              key={b.bucketStart}
              className="ci-weather__block"
              data-state={b.state}
              title={title}
            />
          )
        })}
      </figure>
      {open && (
        <section className="ci-failed-popover" aria-label="Failed CI runs">
          <div className="ci-trend-popover__title">
            Failed · {formatRelativeTime(open.bucketStart)}
          </div>
          {failed.length === 0 ? (
            <p>
              No failed run from this hour is in the loaded data. The bar is carried forward from an
              earlier failure, or the run is older than the history the dashboard keeps.
            </p>
          ) : (
            <ul>
              {failed.map((f) => (
                <FailedRunItem key={f.key} item={f} />
              ))}
            </ul>
          )}
        </section>
      )}
      {/* Visible count parity with the aria-label (which already announces it,
          so this is hidden from SR to avoid a double read). */}
      <span className="ci-weather__readout" aria-hidden="true">
        {failing} failing · {healthy} healthy
      </span>
    </div>
  )
}
