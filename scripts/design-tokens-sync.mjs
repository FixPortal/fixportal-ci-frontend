import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const TOKENS = [
  '--app-bg', '--card-bg', '--border', '--border-strong', '--text', '--text-muted',
  '--text-faint', '--brand', '--ok-border', '--bad-solid', '--bad-text', '--warn-text',
  '--warn-fill-deep', '--font-sans', '--font-mono',
]

// EMPTY, and that is the finding rather than an omission.
//
// This map held one entry, --text-muted light, described as a deliberate accessibility
// override because the shared value did not clear contrast on this board's card
// background. Re-measured against the shared sheet as it stands today:
//
//   --text-muted  shared #5a6472   6.00:1 on --card-bg, 5.58:1 on --app-bg
//                 pinned #5f6472   5.91:1 on --card-bg, 5.50:1 on --app-bg
//
// Upstream has since made the same correction, and made it slightly better. The pin was
// no longer buying contrast - it was costing a little, while reporting "matches" and
// keeping the token outside the drift detector. Same for the two undeclared local
// lightenings of --text-faint, light and dark, which the vendored sheet carried in
// comments rather than here. All three are re-synced; see packages/ci-frontend/src/
// styles/tokens.css for the measured ratios.
//
// The dark --warn-text entry that used to sit here was NOT an accessibility override. It
// pinned #f0abfc, which upstream retired in favour of #fcd34d as a palette decision --
// fuchsia carries no warning convention and collided with a purple accent. Pinning it
// blessed the gap permanently: the checker reported "matches" while the board rendered a
// colour upstream no longer ships, so the one real drift this tool existed to catch was
// the one it was configured to ignore. Re-synced rather than re-pinned.
//
// That is now three entries added for a good reason and outlived by upstream. Before
// adding a fourth, re-measure: an override is a claim about TODAY's shared value, and it
// stops being true silently.
const OVERRIDES = {
  light: {},
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

// The shared sheet lives in a SIBLING checkout, so the default is a guess about how the
// machine is laid out. Two things make that guess better than it was.
//
// It is resolved from the repository, not from the current working directory. `..` from
// the CWD is only right when the script is run from the repo root of a plain clone; from
// a review worktree (.claude/worktrees/<name>) it pointed at
// .claude/worktrees/fixportal-assets, which cannot exist - so the check could never run
// in the workspace where remediation actually happens, and failed with a bare ENOENT
// stack trace. `git rev-parse --git-common-dir` names the MAIN worktree's .git, whose
// parent is the real clone, whichever worktree we are standing in.
//
// And when the guess is wrong it now says so, and says what to do instead, rather than
// throwing a Node filesystem trace at the reader.
export function repoRoot() {
  try {
    const gitCommonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return path.dirname(path.resolve(gitCommonDir))
  } catch {
    // Not a git checkout, or no git on PATH. Fall back to the old CWD-relative guess
    // rather than failing here - the caller reports a missing file clearly either way.
    return process.cwd()
  }
}

/** THIS working tree's root, which is not repoRoot() inside a linked worktree.
 *  The two anchors are different on purpose: the vendored sheet is the one in the tree
 *  being checked, while the shared sheet is a sibling of the MAIN checkout - a worktree
 *  has no siblings of its own. Anchoring the vendored path here is what stops the verdict
 *  depending on the directory the script was invoked from: with source repo-anchored and
 *  vendored cwd-relative, running from packages/ci-frontend looked for
 *  packages/ci-frontend/packages/ci-frontend/src/styles/tokens.css and produced no verdict
 *  at all on unchanged disk state. */
export function worktreeRoot() {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    // path.resolve, and not merely for tidiness: on Windows `--show-toplevel` answers with
    // FORWARD slashes ('C:/Users/...'), while repoRoot() goes through path.resolve and
    // answers with backslashes. Two anchors that disagree about separators compare unequal
    // to each other and to anything built from either, which is how a path check passes in
    // one place and fails in another on the same directory.
    return path.resolve(top)
  } catch {
    return process.cwd()
  }
}

export function defaultSourcePath() {
  return process.env.FIXPORTAL_DESIGN_TOKENS
    ? path.resolve(process.env.FIXPORTAL_DESIGN_TOKENS)
    : path.resolve(repoRoot(), '..', 'fixportal-assets', 'packages', 'design', 'tokens.css')
}

/**
 * The dashboard shell paints a background BEFORE the token sheet loads, so
 * apps/dashboard/index.html carries a literal fallback in `var(--app-bg, <hex>)`. Nothing
 * links that literal to the token, and it is in a different file from every other colour
 * this script reads - so when --app-bg was re-synced it kept the old value and flashed it
 * on every cold load. A comment would rely on the next person remembering; this is the
 * same "hand-maintained copy drifts silently" failure the rest of the script exists for,
 * so it gets checked rather than documented.
 *
 * Absent file or absent fallback is NOT a difference: the shell is allowed to stop doing
 * this. A fallback that disagrees is.
 */
export function compareShellFallback(shellHtml, vendoredCss) {
  const declared = shellFallbacks(shellHtml)
  if (declared.length === 0) return []
  const expected = values(vendoredCss, ':root')['--app-bg']
  if (expected === undefined) return ['shell fallback: --app-bg is missing from the vendored :root block']
  return declared
    .filter((actual) => actual.toLowerCase() !== expected.toLowerCase())
    .map((actual) => `shell fallback: var(--app-bg, ${actual}) disagrees with the light --app-bg ${expected} - the pre-paint frame would flash the wrong colour`)
}

/**
 * Every `var(--app-bg, <fallback>)` fallback in the shell, depth-matched.
 *
 * Depth-matched rather than `[^)]+`, because a fallback is a colour and a colour may be a
 * function: `var(--app-bg, rgb(0 0 0))` truncates at the first `)` under a lazy character
 * class and captures `rgb(0 0 0`, which then never equals the token and reports drift that
 * is not there - a false failure in a check whose whole job is to be believed. And ALL
 * matches, not just the first: a second declaration further down the file is exactly the
 * one that would be forgotten in a re-sync.
 */
function shellFallbacks(shellHtml) {
  const found = []
  const opener = /var\(\s*--app-bg\s*,\s*/g
  for (let m = opener.exec(shellHtml); m !== null; m = opener.exec(shellHtml)) {
    let depth = 1
    let i = m.index + m[0].length
    for (; i < shellHtml.length && depth > 0; i += 1) {
      if (shellHtml[i] === '(') depth += 1
      else if (shellHtml[i] === ')') depth -= 1
    }
    // depth > 0 means the declaration is unterminated - malformed CSS, not our business.
    if (depth === 0) found.push(shellHtml.slice(m.index + m[0].length, i - 1).trim())
  }
  return found
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sourcePath = process.argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length) ?? defaultSourcePath()
  const vendoredPath = path.resolve(worktreeRoot(), 'packages', 'ci-frontend', 'src', 'styles', 'tokens.css')
  let sourceCss
  let vendoredCss
  try {
    ;[sourceCss, vendoredCss] = await Promise.all([
      readFile(path.resolve(sourcePath), 'utf8'),
      readFile(vendoredPath, 'utf8'),
    ])
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err
    // Promise.all surfaces ONE rejection, so say which file it was and give advice that
    // can actually fix that arm. Undifferentiated, a missing vendored sheet printed
    // "point at the shared sheet with --source=", which is no help at all.
    console.error(`Could not read ${err.path}`)
    console.error(
      path.resolve(err.path ?? '') === vendoredPath
        ? `That is this repo's vendored token sheet, expected at ${vendoredPath}. ` +
            'If the path looks wrong, the working tree could not be located - run from inside the repository.'
        : 'That is the shared token sheet, expected in a fixportal-assets checkout beside this repo. ' +
            'Point at it explicitly with --source=<path> or FIXPORTAL_DESIGN_TOKENS=<path>.',
    )
    process.exitCode = 1
    process.exit()
  }
  // The dashboard shell is optional - this script also runs in checkouts of the published
  // package, which has no apps/. A missing shell is not drift.
  const shellPath = path.resolve(worktreeRoot(), 'apps', 'dashboard', 'index.html')
  let shellHtml = null
  try {
    shellHtml = await readFile(shellPath, 'utf8')
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err
  }

  const differences = [
    ...compare(sourceCss, vendoredCss),
    ...(shellHtml === null ? [] : compareShellFallback(shellHtml, vendoredCss)),
  ]
  if (differences.length > 0) {
    console.error('Design token drift detected:')
    for (const difference of differences) console.error(`- ${difference}`)
    process.exitCode = 1
  } else {
    console.log(`Design token projection matches ${sourcePath}`)
  }
}
