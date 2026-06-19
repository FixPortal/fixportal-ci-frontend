// Defines the abbreviations on each repo's Lizard metrics line. Rendered once at
// the foot of the board; the same wording backs the per-metric hover tooltips.
const ITEMS: ReadonlyArray<readonly [string, string]> = [
  ['NLOC', 'non-comment lines of code'],
  ['avg CCN', 'average cyclomatic complexity (branch paths per function)'],
  ['functions', 'number of functions'],
  ['complex', 'functions over CCN 15 — refactor candidates'],
]

export function MetricsLegend() {
  return (
    <footer className="metrics-legend" aria-label="Lizard metrics legend">
      <span className="metrics-legend__title">Lizard metrics</span>
      {ITEMS.map(([term, meaning]) => (
        <span key={term} className="metrics-legend__item">
          <b>{term}</b> {meaning}
        </span>
      ))}
    </footer>
  )
}
