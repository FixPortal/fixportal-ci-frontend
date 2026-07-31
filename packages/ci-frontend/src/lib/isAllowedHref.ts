function isSafeRelativeHref(url: string): boolean {
  // Reject control characters and backslashes in relative hrefs.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(url)) return false

  // Allow same-origin relative forms:
  // - "/path" (but not protocol-relative "//host")
  // - "?query"
  // - "#fragment"
  if (url.startsWith('/')) return !url.startsWith('//')
  if (url.startsWith('?')) return true
  if (url.startsWith('#')) return true

  return false
}

export function isAllowedHref(url: unknown): string {
  // Untrusted-shape hardening: the snapshot boundary does no runtime validation
  // (this is a published library -- consumers point it at their own backends),
  // so a non-string (number, object, etc.) can reach here despite every call
  // site's string-typed signature. Guard here, not per-call-site, so every
  // caller -- present and future -- inherits the same root-cause fix.
  if (typeof url !== 'string' || url.length === 0) return '#'

  if (isSafeRelativeHref(url)) {
    return url
  }

  // Accept only http: and https: protocols to prevent javascript: or data: injection.
  // Using URL parser to be safe against malformed absolute strings.
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url
    }
  } catch {
    // Invalid absolute URL.
  }
  return '#'
}
