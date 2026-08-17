// The woff2 files in public/fonts/ are vendored copies of the installed
// @fontsource/ibm-plex-{sans,mono} packages (see the @font-face block in
// dashboard.css). Those packages are devDependencies nothing imports, so
// nothing else enforces the sync — a Dependabot bump would silently falsify
// the "mirror the installed version" claim. Byte-compare them instead.
//
// @types/node isn't a dependency of this app; vitest runs on Node regardless
// (same rationale as packages/ci-frontend's board.css.test.ts).
// @ts-expect-error -- no @types/node in this app, see comment above
import { readFileSync, readdirSync } from 'node:fs'
// @ts-expect-error -- no @types/node in this app, see comment above
import { dirname, join } from 'node:path'
// @ts-expect-error -- no @types/node in this app, see comment above
import { fileURLToPath } from 'node:url'
// @ts-expect-error -- no @types/node in this app, see comment above
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const here = import.meta.url
const fontsDir = fileURLToPath(new URL('../public/fonts', here))
// Cast: node:fs is untyped here (no @types/node, see header) and it.each needs
// a concrete element type to check its callback signature.
const vendored = (readdirSync(fontsDir) as string[]).filter(file => file.endsWith('.woff2'))

// createRequire resolves through the workspace root's hoisted node_modules.
// No return annotation: Buffer's type comes from @types/node, which this app
// deliberately does not depend on (see header).
function fontsourceFile(file: string) {
  const pkg = file.startsWith('ibm-plex-mono-') ? '@fontsource/ibm-plex-mono' : '@fontsource/ibm-plex-sans'
  const pkgDir = dirname(require.resolve(`${pkg}/package.json`))
  return readFileSync(join(pkgDir, 'files', file))
}

describe('vendored IBM Plex fonts', () => {
  it('vendors exactly the seven preloaded faces', () => {
    expect([...vendored].sort()).toEqual([
      'ibm-plex-mono-latin-400-normal.woff2',
      'ibm-plex-mono-latin-500-normal.woff2',
      'ibm-plex-mono-latin-600-normal.woff2',
      'ibm-plex-sans-latin-400-normal.woff2',
      'ibm-plex-sans-latin-500-normal.woff2',
      'ibm-plex-sans-latin-600-normal.woff2',
      'ibm-plex-sans-latin-700-normal.woff2',
    ])
  })

  it.each(vendored)('%s byte-matches the installed @fontsource package', file => {
    const local = readFileSync(join(fontsDir, file))
    expect(local.equals(fontsourceFile(file))).toBe(true)
  })
})
