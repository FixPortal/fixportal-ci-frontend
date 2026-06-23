import { useEffect, useMemo, useRef, useState } from 'react'
import type { CiTrendBucket, MergedPr, SummaryCount } from '../api/types'
import type { OpenPr } from '../lib/flattenOpenPrs'
import { formatCompactNumber } from '../lib/formatCompactNumber'
import { formatRelativeTime } from '../lib/relativeTime'
import { CiWeatherBar } from './CiWeatherBar'
import { isAllowedHref } from '../lib/isAllowedHref'
const SUMMARY_LABELS: Record<string, string> = {
  repos: 'Repositories',
  workflows: 'Workflows',
  failing: 'Failing',
  running: 'Running',
  'no-ci': 'No CI',
  'open-prs': 'Open PRs',
  'nloc-fixportal': 'FixPortal loc',
  'nloc-quickfixn': 'quickfix/n loc',
  deploys: 'Deployments',
  packages: 'Packages',
  'deploys-failing': 'Deploys failing',
  'deploys-running': 'Deploys running',
  'packages-failing': 'Packages failing',
}

// Three panels group the counts by what the operator is looking for: review work,
// pipeline health, and inventory. Keys appear in this fixed order regardless of the
// summary array's order; a panel with no present keys is hidden.
const PANELS: { title: string; keys: string[] }[] = [
  { title: 'Review', keys: ['open-prs'] },
  { title: 'CI status', keys: ['running', 'failing', 'packages-failing', 'deploys-running', 'deploys-failing', 'no-ci'] },
  { title: 'Inventory', keys: ['repos', 'workflows', 'nloc-fixportal', 'nloc-quickfixn', 'deploys', 'packages'] },
]

const NEUTRAL_KEYS = new Set(['repos', 'workflows', 'nloc-fixportal', 'nloc-quickfixn', 'deploys', 'packages'])
const EMPTY_TREND: CiTrendBucket[] = []

type SummaryStripProps = {
  summary: SummaryCount[]
  onOpenPrs?: () => void
  lastMerged: MergedPr | null
  nextPr?: OpenPr | null
  ciTrend?: CiTrendBucket[]
}

function labelFor(key: string, count: number) {
  // 'Open PRs' is the only count-driven noun on the strip; singularise it so a
  // single PR doesn't read as '1 Open PRs'.
  if (key === 'open-prs') return count === 1 ? 'Open PR' : 'Open PRs'
  return SUMMARY_LABELS[key] ?? key.replaceAll('-', ' ')
}

function formatCount(key: string, count: number) {
  return (key === 'nloc-fixportal' || key === 'nloc-quickfixn') ? formatCompactNumber(count) : count
}

// A non-zero count is coloured to mirror its chip: failures red, running blue,
// no-ci indigo, the rest amber. open-prs gets its own non-alarm "review" tone.
// Zero / inventory quiet.
function toneFor(key: string, count: number): string {
  if (count === 0 || NEUTRAL_KEYS.has(key)) return 'ok'
  if (key === 'open-prs') return 'review'
  if (key === 'failing' || key === 'deploys-failing' || key === 'packages-failing') return 'fail'
  if (key === 'running' || key === 'deploys-running') return 'run'
  if (key === 'no-ci') return 'no-ci'
  return 'alert'
}

export function SummaryStrip({ summary, onOpenPrs, lastMerged, nextPr = null, ciTrend = EMPTY_TREND }: SummaryStripProps) {
  const byKey = useMemo(() => new Map(summary.map(s => [s.key, s.count])), [summary])

  const [trendInfoOpen, setTrendInfoOpen] = useState(false)
  const trendLabelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!trendInfoOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (!trendLabelRef.current?.contains(e.target as Node)) setTrendInfoOpen(false)
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTrendInfoOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [trendInfoOpen])

  return (
    <section className="summary-panels">
      {PANELS.map(panel => {
        const items: { key: string; count: number }[] = []
        for (const k of panel.keys) {
          const count = byKey.get(k)
          if (count !== undefined) items.push({ key: k, count })
        }
        if (items.length === 0) return null
        const isReview = panel.title === 'Review'
        const isCiStatus = panel.title === 'CI status'
        const lastMergedHref = (isReview && lastMerged) ? isAllowedHref(lastMerged.htmlUrl) : '#'
        const panelClassName = ['summary-panel', isReview && 'summary-panel--review', isCiStatus && 'summary-panel--ci'].filter(Boolean).join(' ')
        return (
          <div key={panel.title} className={panelClassName}>
            <span className="summary-panel__title">{panel.title}</span>
            <div className="summary-panel__items">
              {items.map(item => {
                const body = (
                  <>
                    <span className="summary__count">{formatCount(item.key, item.count)}</span>
                    <span className="summary__label">{labelFor(item.key, item.count)}</span>
                  </>
                )
                if (item.key === 'open-prs' && onOpenPrs) {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="summary__item summary__item--btn"
                      data-key={item.key}
                      data-tone={toneFor(item.key, item.count)}
                      onClick={onOpenPrs}
                      disabled={item.count === 0}
                    >{body}</button>
                  )
                }
                return (
                  <div key={item.key} className="summary__item" data-key={item.key} data-tone={toneFor(item.key, item.count)}>{body}</div>
                )
              })}
            </div>
            {isReview && nextPr && (
              <div className="summary-panel__next">
                <span className="summary-panel__q-lab">next in queue</span>
                <span className="summary-panel__q-body">{nextPr.repo} #{nextPr.number}</span>
                <span className="summary-panel__q-title">{nextPr.title}</span>
              </div>
            )}
            {isReview && lastMerged && (lastMergedHref !== '#' ? (
              <a className="summary-panel__merged" href={lastMergedHref} target="_blank" rel="noopener noreferrer">
                <span className="summary-panel__q-lab">
                  last merged <span className="summary-panel__q-age">({formatRelativeTime(lastMerged.mergedAt)})</span>
                </span>
                <span className="summary-panel__q-body">{lastMerged.repo} #{lastMerged.number}</span>
                <span className="summary-panel__q-title">{lastMerged.title}</span>
              </a>
            ) : (
              <div className="summary-panel__merged summary-panel__merged--static">
                <span className="summary-panel__q-lab">
                  last merged <span className="summary-panel__q-age">({formatRelativeTime(lastMerged.mergedAt)})</span>
                </span>
                <span className="summary-panel__q-body">{lastMerged.repo} #{lastMerged.number}</span>
                <span className="summary-panel__q-title">{lastMerged.title}</span>
              </div>
            ))}
            {panel.title === 'CI status' && ciTrend.length > 0 && (
              <div className="summary-panel__trend">
                <CiWeatherBar trend={ciTrend} />
                <div ref={trendLabelRef} className="summary-panel__trend-label-row">
                  <span className="summary-panel__trend-lab">CI health · 24h</span>
                  <button
                    type="button"
                    className="ci-trend-info-btn"
                    aria-label="CI health information"
                    aria-expanded={trendInfoOpen}
                    aria-controls={trendInfoOpen ? 'ci-trend-popover' : undefined}
                    onClick={() => setTrendInfoOpen(o => !o)}
                  >
                    i
                  </button>
                  {trendInfoOpen && (
                    <section
                      id="ci-trend-popover"
                      aria-label="CI health explanation"
                      className="ci-trend-popover"
                    >
                      <div className="ci-trend-popover__title">CI health · 24h</div>
                      <p>Each bar is a 1-hour bucket of CI activity across the whole org.</p>
                      <p><span aria-hidden="true" className="ci-trend-popover__swatch ci-trend-popover__swatch--fail">■</span> Red — any run failed that hour (on any branch).</p>
                      <p><span aria-hidden="true" className="ci-trend-popover__swatch ci-trend-popover__swatch--pass">■</span> Green — runs present, none failed.</p>
                      <p>Grey bars are quiet hours with no CI runs in that hour.</p>
                      <p>Oldest bar on the left, newest on the right.</p>
                      <div className="ci-trend-popover__caret" aria-hidden="true" />
                    </section>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
