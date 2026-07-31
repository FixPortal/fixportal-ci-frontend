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
  it.each(['clean', 'outstanding', 'pending', 'disabled'])('defines .chip--review-%s', state => {
    expect(css).toContain(`.chip--review-${state}`)
  })
})
