import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CiWeatherBar } from './CiWeatherBar'
import type { CiTrendBucket } from '../api/types'

const bucket = (state: CiTrendBucket['state']): CiTrendBucket =>
  ({ bucketStart: '2026-05-30T11:00:00Z', state })

describe('CiWeatherBar', () => {
  it('renders one block per bucket with a state-keyed data attribute', () => {
    const trend = [bucket('passing'), bucket('failing'), bucket('noData')]
    const { container, getByRole } = render(<CiWeatherBar trend={trend} />)
    const blocks = container.querySelectorAll('.ci-weather__block')
    expect(blocks).toHaveLength(3)
    expect(blocks[0].getAttribute('data-state')).toBe('passing')
    expect(blocks[1].getAttribute('data-state')).toBe('failing')
    expect(blocks[2].getAttribute('data-state')).toBe('noData')
    expect(getByRole('img')).toBeInTheDocument()
  })

  it('summarises health in the accessible label', () => {
    const trend = [bucket('failing'), bucket('failing'), bucket('passing')]
    const { getByRole } = render(<CiWeatherBar trend={trend} />)
    expect(getByRole('img').getAttribute('aria-label'))
      .toMatch(/CI health, last 24h: 2 failing/i)
  })

  it('renders nothing for an empty trend', () => {
    const { container } = render(<CiWeatherBar trend={[]} />)
    expect(container.querySelector('.ci-weather')).toBeNull()
  })

  it('shows a visible count readout and per-block hover titles', () => {
    const trend = [bucket('failing'), bucket('failing'), bucket('passing')]
    const { container, getByText } = render(<CiWeatherBar trend={trend} />)
    expect(getByText(/2 failing/)).toBeInTheDocument()
    expect(container.querySelector('.ci-weather__block')?.getAttribute('title')).toMatch(/failing/i)
  })
})
