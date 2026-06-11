import { describe, it, expect } from 'vitest'
import { isAllowedHref } from './isAllowedHref'

describe('isAllowedHref', () => {
  it('passes through http: and https: absolute URLs unchanged', () => {
    expect(isAllowedHref('https://github.com/o/r')).toBe('https://github.com/o/r')
    expect(isAllowedHref('http://example.com')).toBe('http://example.com')
  })

  it('passes through same-origin relative paths', () => {
    expect(isAllowedHref('/ci')).toBe('/ci')
    expect(isAllowedHref('/repos/owner/name')).toBe('/repos/owner/name')
  })

  it('passes through query and fragment relative forms', () => {
    expect(isAllowedHref('?tab=open')).toBe('?tab=open')
    expect(isAllowedHref('#section')).toBe('#section')
  })

  it('rejects protocol-relative URLs that browsers resolve cross-origin', () => {
    expect(isAllowedHref('//evil.com/path')).toBe('#')
    expect(isAllowedHref('//evil.com')).toBe('#')
    expect(isAllowedHref('///evil.com')).toBe('#')
    expect(isAllowedHref('////evil.com/path')).toBe('#')
    expect(isAllowedHref('// evil.com')).toBe('#')
    expect(isAllowedHref('//\tevil.com')).toBe('#')
  })

  it('rejects javascript:, data: and vbscript: scheme injection', () => {
    expect(isAllowedHref('javascript:alert(1)')).toBe('#')
    expect(isAllowedHref('data:text/html,<script>alert(1)</script>')).toBe('#')
    expect(isAllowedHref('vbscript:msgbox')).toBe('#')
  })

  it('rejects other non-http schemes', () => {
    expect(isAllowedHref('ftp://example.com/file')).toBe('#')
    expect(isAllowedHref('mailto:a@b.com')).toBe('#')
  })

  it('rejects relative hrefs with control characters or backslashes', () => {
    expect(isAllowedHref('/path\x00evil')).toBe('#')
    expect(isAllowedHref('/path\\evil')).toBe('#')
    expect(isAllowedHref('/path\x1fevil')).toBe('#')
  })

  it('returns # for empty, undefined, or null input', () => {
    expect(isAllowedHref('')).toBe('#')
    expect(isAllowedHref(undefined)).toBe('#')
    expect(isAllowedHref(null)).toBe('#')
  })
})
