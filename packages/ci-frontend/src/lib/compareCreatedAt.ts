// Oldest first by the instant a PR was opened. Parse, don't compare the text: a
// third-party backend can mix offsets and fractional precision, where string order
// lies. An unparseable timestamp sorts last so it cannot poison the comparison.
export function compareCreatedAt(
  a: { number: number; createdAt: string },
  b: { number: number; createdAt: string },
): number {
  const aTime = Date.parse(a.createdAt)
  const bTime = Date.parse(b.createdAt)
  if (Number.isNaN(aTime) !== Number.isNaN(bTime)) return Number.isNaN(aTime) ? 1 : -1
  if (!Number.isNaN(aTime) && aTime !== bTime) return aTime - bTime
  return a.number - b.number
}
