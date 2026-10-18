import { fireEvent, render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CiWeatherBar } from './CiWeatherBar'
import type { CiTrendBucket, RepositorySnapshot } from '../api/types'

const bucket = (state: CiTrendBucket['state'], hour: number): CiTrendBucket => ({
  bucketStart: new Date(Date.UTC(2026, 4, 30, hour)).toISOString(),
  state,
})

describe('CiWeatherBar', () => {
  it('renders one block per bucket with a state-keyed data attribute', () => {
    const trend = [bucket('passing', 9), bucket('failing', 10), bucket('noData', 11)]
    const { container, getByRole } = render(<CiWeatherBar trend={trend} />)
    const blocks = container.querySelectorAll('.ci-weather__block')
    expect(blocks).toHaveLength(3)
    expect(blocks[0]!.getAttribute('data-state')).toBe('passing')
    expect(blocks[1]!.getAttribute('data-state')).toBe('failing')
    expect(blocks[2]!.getAttribute('data-state')).toBe('noData')
    expect(getByRole('img')).toBeInTheDocument()
  })

  it('summarises health in the accessible label', () => {
    const trend = [bucket('failing', 9), bucket('failing', 10), bucket('passing', 11)]
    const { getByRole } = render(<CiWeatherBar trend={trend} />)
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/CI health, last 24h: 2 failing/i)
  })

  it('renders nothing for an empty trend', () => {
    const { container } = render(<CiWeatherBar trend={[]} />)
    expect(container.querySelector('.ci-weather')).toBeNull()
  })

  it('shows a visible count readout and per-block hover titles', () => {
    const trend = [bucket('failing', 9), bucket('failing', 10), bucket('passing', 11)]
    const { container, getByText } = render(<CiWeatherBar trend={trend} />)
    expect(getByText(/2 failing/)).toBeInTheDocument()
    expect(container.querySelector('.ci-weather__block')?.getAttribute('title')).toMatch(/failing/i)
  })

  it('opens a popover naming the failed runs when a failing block is clicked', () => {
    const repositories = [
      {
        name: 'repo-a',
        workflows: [
          {
            name: 'CI',
            file: 'ci.yml',
            state: 'failure',
            lastRun: {
              status: 'completed',
              conclusion: 'failure',
              htmlUrl: 'https://github.com/o/repo-a/actions/runs/1',
              title: 't',
              runNumber: 1,
              branch: 'main',
              event: 'push',
              updatedAt: new Date(Date.UTC(2026, 4, 30, 10, 20)).toISOString(),
            },
          },
        ],
      },
    ] as unknown as RepositorySnapshot[]
    const trend = [bucket('passing', 9), bucket('failing', 10)]
    const { getByRole, queryByRole } = render(
      <CiWeatherBar trend={trend} repositories={repositories} />,
    )
    expect(queryByRole('region', { name: 'Failed CI runs' })).toBeNull()
    fireEvent.click(getByRole('button', { name: /failing/i }))
    const popover = getByRole('region', { name: 'Failed CI runs' })
    expect(popover).toHaveTextContent('repo-a · CI · main')
  })
})
