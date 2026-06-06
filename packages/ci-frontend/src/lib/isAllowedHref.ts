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
    // If it's a relative URL or invalid, check if it starts with / (same-origin relative URL is safe)
    if (url.startsWith('/')) {
      return url
    }
  }
  return '#'
}
