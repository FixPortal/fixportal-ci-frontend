/** Compact integer formatting for large counts: 12345 -> "12.3k", 980 -> "980". */
export function formatCompactNumber(value: number): string {
  if (value < 1000) return String(value)
  if (value < 999950) return `${(value / 1000).toFixed(1)}k`
  return `${(value / 1_000_000).toFixed(1)}M`
}
