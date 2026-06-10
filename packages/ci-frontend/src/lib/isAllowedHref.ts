export function isAllowedHref(url: string | undefined): string {
  if (!url) return '#'
  // Accept only http: and https: protocols to prevent javascript: or data: injection.
  // Using a try/catch with URL parser to be safe against malformed strings.
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url
    }
  } catch {
    // Relative URL or invalid string. A leading single "/" is a same-origin
    // path and safe; reject protocol-relative "//host" URLs, which the parser
    // also rejects (no scheme) but browsers resolve to a cross-origin https:.
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url
    }
  }
  return '#'
}
