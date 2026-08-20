import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const TOKENS = [
  '--app-bg', '--card-bg', '--border', '--border-strong', '--text', '--text-muted',
  '--text-faint', '--brand', '--ok-border', '--bad-solid', '--bad-text', '--warn-text',
  '--warn-fill-deep', '--font-sans', '--font-mono',
]

// The board has two deliberate accessibility overrides over the shared source.
const OVERRIDES = {
  light: { '--text-muted': '#5f6472' },
  dark: { '--warn-text': '#f0abfc' },
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

export function compare(sourceCss, vendoredCss) {
  const source = {
    light: values(sourceCss, ':root'),
    dark: values(sourceCss, ':root[data-theme="dark"], [data-theme="dark"]'),
  }
  const vendored = {
    light: values(vendoredCss, ':root'),
    dark: values(vendoredCss, '.ci-page[data-theme="dark"]'),
  }
  const differences = []

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
