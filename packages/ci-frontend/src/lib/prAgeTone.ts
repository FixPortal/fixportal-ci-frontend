// Age-based emphasis for an open PR card edge: stale PRs warm up.
export type AgeTone = 'red' | 'amber' | 'quiet'

export function prAgeTone(createdAtIso: string, now: number = Date.now()): AgeTone {
  const days = (now - new Date(createdAtIso).getTime()) / 86_400_000
  if (days > 14) return 'red'
  if (days > 7) return 'amber'
  return 'quiet'
}
