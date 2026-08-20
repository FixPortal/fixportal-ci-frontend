// GitHub renders reusable-workflow / matrix job names as "caller / called", which
// for a deploy or publish job is often the same segment twice
// ("Deploy (x) / Deploy (x)"). Collapse consecutive identical segments so the chip
// reads once; genuinely different segments are preserved.
export function dedupeJobLabel(name: string): string {
  const parts = name.split(' / ')
  const deduped = parts.filter((part, i) => i === 0 || part !== parts[i - 1])
  return deduped.join(' / ')
}
