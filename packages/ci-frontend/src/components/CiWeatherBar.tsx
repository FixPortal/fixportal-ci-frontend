import type { CiTrendBucket, CiTrendState } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'

// A status-page "weather" strip: one block per hourly bucket, coloured by the
// carry-forward worst-state from the backend. Pure presentational; colours come
// from CSS via the data-state attribute.
const BLOCK_WORD: Record<CiTrendState, string> = {
  passing: 'healthy',
  failing: 'failing',
  noData: 'no data',
}

export function CiWeatherBar({ trend }: { trend: CiTrendBucket[] }) {
  if (trend.length === 0) return null
  const failing = trend.filter(b => b.state === 'failing').length
  const healthy = trend.filter(b => b.state === 'passing').length
  const label = `CI health, last 24h: ${failing} failing, ${healthy} healthy`
  return (
    <>
      <figure className="ci-weather" aria-label={label}>
        {trend.map((b, i) => (
          // Per-block hover reveals which hour a block is and its state — the
          // data was previously exposed only to screen readers via aria-label.
          <span
            key={i}
            className="ci-weather__block"
            data-state={b.state}
            title={`${formatRelativeTime(b.bucketStart)} · ${BLOCK_WORD[b.state]}`}
          />
        ))}
      </figure>
      {/* Visible count parity with the aria-label (which already announces it,
          so this is hidden from SR to avoid a double read). */}
      <span className="ci-weather__readout" aria-hidden="true">
        {failing} failing · {healthy} healthy
      </span>
    </>
  )
}
