import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const TOKENS = [
  '--app-bg', '--card-bg', '--border', '--border-strong', '--text', '--text-muted',
  '--text-faint', '--brand', '--ok-border', '--bad-solid', '--bad-text', '--warn-text',
  '--warn-fill-deep', '--font-sans', '--font-mono',
]

// ONE deliberate accessibility override over the shared source: the shared --text-muted
// does not clear contrast on this board's card background.
//
// The dark --warn-text entry that used to sit here was NOT an accessibility override. It
// pinned #f0abfc, which upstream retired in favour of #fcd34d as a palette decision --
// fuchsia carries no warning convention and collided with a purple accent. Pinning it
// blessed the gap permanently: the checker reported "matches" while the board rendered a
// colour upstream no longer ships, so the one real drift this tool existed to catch was
// the one it was configured to ignore. Re-synced rather than re-pinned.
const OVERRIDES = {
  light: { '--text-muted': '#5f6472' },
  dark: {},
}

function block(css, selector) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`Could not find ${selector} block`)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  throw new Error(`Unclosed ${selector} block`)
}

export function values(css, selector) {
  const declarations = block(css, selector)
  const result = {}
  for (const match of declarations.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    result[match[1]] = match[2].trim()
  }
  return result
}

// Absent-tolerant read, SCOPED to a containing block. `values` throws on a missing
// selector, which is right for the blocks that must exist and wrong for the media-dark
// block, which a minimal fixture legitimately omits.
//
// The scoping is the load-bearing half. Searching the whole sheet meant a stylesheet
// carrying `.ci-page:not([data-theme="light"])` OUTSIDE the media query, while the media
// query itself lacked it, read as present and reported nothing - leaving the
// OS-preference tokens unchecked, which is the exact defect this check exists to catch.
// Returns null so the caller can distinguish "absent" from "empty".
function optionalValues(css, selector) {
  return css.includes(`${selector} {`) ? values(css, selector) : null
}

// The body of `@media (prefers-color-scheme: dark) { ... }`, or null when the sheet has
// no such query. `block` matches brace depth, so a nested rule inside the query is kept.
function prefersDarkBlock(css) {
  const marker = '@media (prefers-color-scheme: dark)'
  return css.includes(`${marker} {`) ? block(css, marker) : null
}

export function compare(sourceCss, vendoredCss) {
  const source = {
    light: values(sourceCss, ':root'),
    dark: values(sourceCss, ':root[data-theme="dark"], [data-theme="dark"]'),
  }
  // The vendored sheet declares the dark set TWICE: once for the explicit
  // [data-theme="dark"] toggle, and again inside @media (prefers-color-scheme: dark) for
  // the viewer who never toggled -- which is the default, and so the more travelled path.
  // Reading only the first left the media block outside the drift detector whose whole
  // purpose is catching drift: a re-sync touching one and not the other printed
  // "matches". Both are read, and they must agree with each other before either is
  // compared against the source.
  const vendored = {
    light: values(vendoredCss, ':root'),
    dark: values(vendoredCss, '.ci-page[data-theme="dark"]'),
  }
  const mediaBlock = prefersDarkBlock(vendoredCss)
  const vendoredMediaDark =
    mediaBlock === null ? null : optionalValues(mediaBlock, '.ci-page:not([data-theme="light"])')
  const differences = []

  if (vendoredMediaDark === null) {
    // A sheet that declares the media query but not the selector INSIDE it has been
    // restructured, and the OS-preference path would go unchecked without anyone
    // noticing -- report it. A sheet with no prefers-color-scheme at all has no second
    // dark block to disagree with, which is the shape the unit fixtures use.
    if (mediaBlock !== null) {
      differences.push(
        'dark: @media (prefers-color-scheme: dark) exists but its .ci-page:not([data-theme="light"]) ' +
          'block was not found, so the OS-preference dark tokens are unchecked',
      )
    }
  } else {
    for (const token of TOKENS) {
      const toggled = vendored.dark[token]
      const preference = vendoredMediaDark[token]
      if (toggled !== preference) {
        differences.push(
          `dark ${token}: [data-theme="dark"] has ${toggled ?? '<missing>'}, ` +
            `@media (prefers-color-scheme: dark) has ${preference ?? '<missing>'}`,
        )
      }
    }
  }

  for (const theme of ['light', 'dark']) {
    for (const token of TOKENS) {
      const expected = OVERRIDES[theme][token] ?? source[theme][token] ?? source.light[token]
      const actual = vendored[theme][token] ?? vendored.light[token]
      if (expected === undefined) differences.push(`${theme} ${token}: missing from source`)
      else if (actual !== expected) differences.push(`${theme} ${token}: expected ${expected}, found ${actual ?? '<missing>'}`)
    }
  }
  return differences
}

export function defaultSourcePath() {
  return process.env.FIXPORTAL_DESIGN_TOKENS
    ? path.resolve(process.env.FIXPORTAL_DESIGN_TOKENS)
    : path.resolve('..', 'fixportal-assets', 'packages', 'design', 'tokens.css')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sourcePath = process.argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length) ?? defaultSourcePath()
  const vendoredPath = path.resolve('packages', 'ci-frontend', 'src', 'styles', 'tokens.css')
  const [sourceCss, vendoredCss] = await Promise.all([
    readFile(path.resolve(sourcePath), 'utf8'),
    readFile(vendoredPath, 'utf8'),
  ])
  const differences = compare(sourceCss, vendoredCss)
  if (differences.length > 0) {
    console.error('Design token drift detected:')
    for (const difference of differences) console.error(`- ${difference}`)
    process.exitCode = 1
  } else {
    console.log(`Design token projection matches ${sourcePath}`)
  }
}
