// @types/node isn't a dependency of this package (it ships a browser-facing UI
// library, not a Node tool), so TS can't resolve these two builtins by name --
// they exist at runtime regardless, since vitest itself runs on Node. Silence
// just the two type errors rather than pulling in the full ambient Node
// surface via a new devDependency.
// @ts-expect-error -- no @types/node in this package, see comment above
import { readFileSync } from 'node:fs'
// @ts-expect-error -- no @types/node in this package, see comment above
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// No component test touches the stylesheet itself -- rendering only asserts a
// class name is present on an element, never that the class is actually
// defined in board.css. Deleting a selector here leaves every render-level
// test green while the pill silently falls back to the bare `.chip` look.
// Guard the four review-pill states directly against the source file.
//
// vitest.config.ts sets `css: false`, which stubs a plain or `?raw` import of
// the stylesheet to an empty module, so read the file directly off disk
// instead. `import.meta.url` is held in a variable rather than passed inline
// to `new URL(...)`: Vite statically recognises the literal
// `new URL('./x', import.meta.url)` pattern as its "asset URL" idiom and
// rewrites it to a dev-server http: URL, which fileURLToPath then rejects.
const here = import.meta.url
const cssPath = fileURLToPath(new URL('./board.css', here))
const css: string = readFileSync(cssPath, 'utf-8')

describe('board.css review pill selectors', () => {
  it.each(['clean', 'outstanding', 'pending', 'disabled', 'unknown'])('defines .chip--review-%s', state => {
    expect(css).toContain(`.chip--review-${state}`)
  })
})

// Same reasoning as the pill-state block above: a render test only asserts the
// class is on the element, never that board.css defines it. Deleting these two
// rules would leave every component test green while the pills lost their
// right alignment and silently re-grew the vertical margin they exist to avoid.
describe('board.css PR-row layout', () => {
  it('right-aligns the pills against the PR link', () => {
    const match = css.match(/\.repo-prs__line\s*\{([^}]*)\}/)
    expect(match).not.toBeNull()
    const body = match![1].replace(/\s+/g, ' ')
    expect(body).toContain('justify-content: space-between')
  })

  it('zeroes the review-pills margin inside a PR row', () => {
    const match = css.match(/\.repo-prs__line \.review-pills\s*\{([^}]*)\}/)
    expect(match).not.toBeNull()
    const body = match![1].replace(/\s+/g, ' ')
    expect(body).toContain('margin: 0')
  })
})

// The "—" unknown-metric count carries meaning (a failed scan must not render
// as a measured 0), so it must clear WCAG AA as text. --unknown is a chip
// fill grey that measures 2.645:1 on light --card-bg; --text-muted is the
// measured-clean ink. Guard the source so the count cannot drift back.
describe('board.css unknown summary count', () => {
  it('inks the unknown count with --text-muted, not --unknown', () => {
    const match = css.match(/\.summary__item\[data-tone="unknown"\] \.summary__count\s*\{([^}]*)\}/)
    expect(match).not.toBeNull()
    const body = match![1].replace(/\s+/g, ' ')
    expect(body).toContain('color: var(--text-muted)')
    expect(body).not.toContain('var(--unknown)')
  })
})

// The skip link must hide with the clipped sr-only idiom: .ci-page sets no
// `position`, so an off-screen translate resolves against the host page's
// nearest positioned ancestor and the "hidden" link can paint over host UI
// when the board is embedded. Guard against the translate regressing.
describe('board.css skip link', () => {
  it('hides via clip, not an off-screen transform', () => {
    const match = css.match(/\.ci-skip-link\s*\{([^}]*)\}/)
    expect(match).not.toBeNull()
    const body = match![1].replace(/\s+/g, ' ')
    expect(body).toContain('clip: rect(0, 0, 0, 0)')
    expect(body).not.toContain('transform')
  })
})
