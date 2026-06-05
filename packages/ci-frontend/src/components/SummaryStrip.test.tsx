import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SummaryStrip } from './SummaryStrip'
import type { CiTrendBucket, MergedPr } from '../api/types'
import type { OpenPr } from '../lib/flattenOpenPrs'

describe('SummaryStrip No-CI tone', () => {
  it('gives a non-zero No-CI count its own "no-ci" tone (not amber alert)', () => {
    render(
      <SummaryStrip
        summary={[{ key: 'no-ci', count: 2 }, { key: 'failing', count: 1 }]}
        onOpenPrs={() => {}}
        lastMerged={null}
      />,
    )
    const item = screen.getByText('No CI').closest('.summary__item')
    expect(item?.getAttribute('data-tone')).toBe('no-ci')
  })

  it('keeps a zero No-CI count neutral', () => {
    render(
      <SummaryStrip
        summary={[{ key: 'no-ci', count: 0 }]}
        onOpenPrs={() => {}}
        lastMerged={null}
      />,
    )
    const item = screen.getByText('No CI').closest('.summary__item')
    expect(item?.getAttribute('data-tone')).toBe('ok')
  })
})

describe('SummaryStrip CI weather bar', () => {
  const trend: CiTrendBucket[] = [
    { bucketStart: '2026-05-30T11:00:00Z', state: 'passing' },
    { bucketStart: '2026-05-30T12:00:00Z', state: 'failing' },
  ]

  it('renders the weather bar in the CI status panel when ciTrend is present', () => {
    render(
      <SummaryStrip summary={[{ key: 'failing', count: 2 }]} onOpenPrs={() => {}}
        lastMerged={null} ciTrend={trend} />,
    )
    expect(screen.getByRole('img', { name: /CI health, last 24h/i })).toBeInTheDocument()
  })

  it('omits the weather bar when ciTrend is empty', () => {
    render(
      <SummaryStrip summary={[{ key: 'failing', count: 0 }]} onOpenPrs={() => {}}
        lastMerged={null} ciTrend={[]} />,
    )
    expect(screen.queryByRole('img', { name: /CI health/i })).toBeNull()
  })

  it('does not render the weather bar in a non-CI panel', () => {
    render(
      <SummaryStrip summary={[{ key: 'open-prs', count: 1 }]} onOpenPrs={() => {}}
        lastMerged={null} ciTrend={trend} />,
    )
    expect(screen.queryByRole('img', { name: /CI health/i })).toBeNull()
  })
})

describe('SummaryStrip open-PR label', () => {
  it('singularises the label for a single open PR', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 1 }]} onOpenPrs={() => {}} lastMerged={null} />)
    expect(screen.getByText('Open PR')).toBeInTheDocument()
  })

  it('pluralises the label for multiple open PRs', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 3 }]} onOpenPrs={() => {}} lastMerged={null} />)
    expect(screen.getByText('Open PRs')).toBeInTheDocument()
  })
})

describe('SummaryStrip last-merged', () => {
  const mergedTitle = 'Cache settlement window'
  const merged: MergedPr = {
    number: 88, title: mergedTitle, author: 'chris', repo: 'fixportal-engine',
    htmlUrl: 'https://github.com/FixPortal/fixportal-engine/pull/88', mergedAt: '2026-05-28T15:00:00Z',
  }

  it('always renders the last-merged PR as a link', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 1 }]} onOpenPrs={() => {}} lastMerged={merged} />)
    expect(screen.getByText(mergedTitle).closest('a')).toHaveAttribute('href', merged.htmlUrl)
  })

  it('shows the merged age on the label and the repo/PR on its own line', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 1 }]} onOpenPrs={() => {}} lastMerged={merged} />)
    expect(screen.getByText(/^\(.+\)$/, { selector: '.summary-panel__q-age' })).toBeInTheDocument()
    expect(screen.getByText('fixportal-engine #88')).toBeInTheDocument()
  })
})

describe('SummaryStrip open-prs interactivity', () => {
  it('renders open-prs as a button when onOpenPrs is provided', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 3 }]} onOpenPrs={() => {}} lastMerged={null} />)
    expect(screen.getByRole('button', { name: /3\s*Open PRs/ })).toBeInTheDocument()
  })

  it('renders open-prs as a static item when onOpenPrs is absent', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 3 }]} lastMerged={null} />)
    expect(screen.queryByRole('button', { name: /3\s*Open PRs/ })).toBeNull()
    expect(screen.getByText('Open PRs')).toBeInTheDocument()
  })
})

describe('SummaryStrip next-in-queue', () => {
  const nextPr: OpenPr = {
    repo: 'fixportal-engine', number: 91, title: 'Wire settlement clock into venue session',
    author: 'chris', htmlUrl: 'https://github.com/FixPortal/fixportal-engine/pull/91',
    isDraft: false, createdAt: '2026-05-30T09:00:00Z',
  }

  it('surfaces the next PR (repo, number, title) on the review panel', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 2 }]} onOpenPrs={() => {}} lastMerged={null} nextPr={nextPr} />)
    expect(document.querySelector('.summary-panel__next')).not.toBeNull()
    expect(screen.getByText('fixportal-engine #91')).toBeInTheDocument()
    expect(screen.getByText('Wire settlement clock into venue session')).toBeInTheDocument()
  })

  it('omits the next-in-queue block when there is no next PR', () => {
    render(<SummaryStrip summary={[{ key: 'open-prs', count: 0 }]} onOpenPrs={() => {}} lastMerged={null} nextPr={null} />)
    expect(document.querySelector('.summary-panel__next')).toBeNull()
  })
})

describe('SummaryStrip deploys-running', () => {
  it('gives a non-zero deploys-running count the "run" tone', () => {
    render(<SummaryStrip summary={[{ key: 'deploys-running', count: 2 }]} onOpenPrs={() => {}} lastMerged={null} />)
    const item = screen.getByText('Deploys running').closest('.summary__item')
    expect(item?.getAttribute('data-tone')).toBe('run')
  })
})
