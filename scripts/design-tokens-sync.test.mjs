import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { compare, compareShellFallback, repoRoot } from './design-tokens-sync.mjs'

const source = `:root { --app-bg: white; --card-bg: white; --border: grey; --border-strong: grey; --text: black; --text-muted: grey; --text-faint: grey; --brand: teal; --ok-border: green; --bad-solid: red; --bad-text: red; --warn-text: amber; --warn-fill-deep: amber; --font-sans: sans; --font-mono: mono; }
:root[data-theme="dark"], [data-theme="dark"] { --app-bg: black; --card-bg: black; --border: grey; --border-strong: grey; --text: white; --text-muted: silver; --text-faint: silver; --warn-text: yellow; }`

const vendored = `:root { --app-bg: white; --card-bg: white; --border: grey; --border-strong: grey; --text: black; --text-muted: grey; --text-faint: grey; --brand: teal; --ok-border: green; --bad-solid: red; --bad-text: red; --warn-text: amber; --warn-fill-deep: amber; --font-sans: sans; --font-mono: mono; }
.ci-page[data-theme="dark"] { --app-bg: black; --card-bg: black; --border: grey; --border-strong: grey; --text: white; --text-muted: silver; --text-faint: silver; --warn-text: yellow; }`

// OVERRIDES is empty now, and these fixtures follow it: light --text-muted was the last
// entry, pinned as an accessibility correction that upstream has since made itself (and
// made slightly better - 6.00:1 against the pin's 5.91:1). Dark --warn-text went the same
// way earlier. Both fixtures previously asserted the PINNED value was acceptable, which is
// precisely the behaviour that let the one real drift this checker exists to catch pass as
// a match. An override is a claim about today's shared value, and it stops being true
// silently, so the tests below assert the detector is ARMED rather than that a pin holds.

test('accepts a vendored sheet that matches the source', () => {
  assert.deepEqual(compare(source, vendored), [])
})

test('reports an unexpected token drift', () => {
  assert.deepEqual(compare(source, vendored.replace('--app-bg: white', '--app-bg: pink')), [
    'light --app-bg: expected white, found pink',
  ])
})

test('reports a token missing from the vendored sheet', () => {
  // --brand has no dark override, so removing it from the light block also blanks the
  // dark-theme fallback (`vendored[theme][token] ?? vendored.light[token]`) — both lines
  // are the correct output, not a light-only diff.
  const withoutToken = vendored.replace('--brand: teal; ', '')
  assert.deepEqual(compare(source, withoutToken), [
    'light --brand: expected teal, found <missing>',
    'dark --brand: expected teal, found <missing>',
  ])
})

test('reports a local pin that an empty OVERRIDES map no longer blesses', () => {
  // The specific value the last override held. While it sat in OVERRIDES this produced
  // NOTHING - the token was outside the detector, which is what made the pin dangerous
  // rather than merely stale. With the map empty it is reported like any other divergence,
  // so this test fails the moment someone re-pins a token instead of re-syncing it.
  const pinned = vendored.replace('--text-muted: grey', '--text-muted: #5f6472')
  assert.deepEqual(compare(source, pinned), [
    'light --text-muted: expected grey, found #5f6472',
  ])
})

// The real sheet declares the dark set twice - once for the [data-theme="dark"] toggle
// and once inside @media (prefers-color-scheme: dark), which is the path a viewer who
// never touched the theme control actually gets. Only the first was read, so a re-sync
// touching one and not the other printed "matches". Each case below fails if the
// agreement check is removed.
const mediaDark = (warnText) =>
  `${vendored}
@media (prefers-color-scheme: dark) {
  .ci-page:not([data-theme="light"]) { --app-bg: black; --card-bg: black; --border: grey; --border-strong: grey; --text: white; --text-muted: silver; --text-faint: silver; --warn-text: ${warnText}; }
}`

test('accepts a media-dark block that agrees with the toggled one', () => {
  assert.deepEqual(compare(source, mediaDark('yellow')), [])
})

test('reports a media-dark block that has drifted from the toggled one', () => {
  assert.deepEqual(compare(source, mediaDark('#ff0000')), [
    'dark --warn-text: [data-theme="dark"] has yellow, @media (prefers-color-scheme: dark) has #ff0000',
  ])
})

test('reports a media query whose selector sits OUTSIDE it rather than within', () => {
  // The unscoped version of this check searched the whole stylesheet, so a selector
  // present anywhere satisfied it -- including here, where the media query itself has a
  // different rule and the OS-preference tokens are genuinely unchecked.
  const outside = `${vendored}
.ci-page:not([data-theme="light"]) { --warn-text: yellow; }
@media (prefers-color-scheme: dark) {
  .something-else { --warn-text: yellow; }
}`
  assert.deepEqual(compare(source, outside), [
    'dark: @media (prefers-color-scheme: dark) exists but its .ci-page:not([data-theme="light"]) block was not found, so the OS-preference dark tokens are unchecked',
  ])
})

// The dashboard shell's pre-paint fallback is a hand-maintained copy of the light
// --app-bg, in a different file from every other colour this script reads. It kept the
// old value through a re-sync and flashed it on every cold load, which is the same silent
// drift the rest of the checker exists to catch - so it is checked, not commented.
const shell = (fallback) => `<style>html, body { background-color: var(--app-bg, ${fallback}); }</style>`

test('accepts a shell fallback equal to the light --app-bg', () => {
  assert.deepEqual(compareShellFallback(shell('white'), vendored), [])
})

test('reports a shell fallback that has drifted from the light --app-bg', () => {
  assert.deepEqual(compareShellFallback(shell('#f7f8fa'), vendored), [
    'shell fallback: var(--app-bg, #f7f8fa) disagrees with the light --app-bg white - the pre-paint frame would flash the wrong colour',
  ])
})

test('treats an absent fallback as fine - the shell may stop doing this', () => {
  assert.deepEqual(compareShellFallback('<style>html { background: red; }</style>', vendored), [])
})

// repoRoot() exists because the CWD-relative version could not run from a review worktree,
// which is the one workspace this checker is most needed in: `..` from
// .claude/worktrees/<name> named .claude/worktrees/fixportal-assets, a path that cannot
// exist, and the script died on a bare ENOENT. Nothing tested that, so it is tested here
// against a REAL worktree rather than a mocked one - the whole point is what git reports,
// and `git rev-parse --git-common-dir` is exactly the call a mock would have to guess at.
// It returns a RELATIVE path from the main checkout and an ABSOLUTE one from a linked
// worktree, so both shapes have to resolve to the same directory.
const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

// Windows temp paths are commonly a short-name junction (C:\Users\X~1). git reports the
// resolved form, so compare against the resolved form or an equal path fails on spelling.
const real = (p) => execFileSync(process.execPath, ['-p', `require('fs').realpathSync(${JSON.stringify(p)})`], {
  encoding: 'utf8',
}).trim()

test('repoRoot resolves to the MAIN checkout from a linked worktree', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'tokens-sync-'))
  const main = path.join(scratch, 'repo')
  const linked = path.join(scratch, 'wt')
  const cwd = process.cwd()
  try {
    mkdirSync(main)
    git(main, 'init', '-q')
    git(main, 'config', 'user.email', 'test@example.invalid')
    git(main, 'config', 'user.name', 'test')
    writeFileSync(path.join(main, 'f.txt'), 'x')
    git(main, 'add', 'f.txt')
    git(main, 'commit', '-qm', 'init')
    git(main, 'worktree', 'add', '-q', linked, 'HEAD')

    // From the main checkout: git reports a RELATIVE '.git'.
    process.chdir(main)
    assert.equal(repoRoot(), real(main))

    // From the linked worktree: git reports an ABSOLUTE path into the main .git. Without
    // the fix this line is the bug - the old code returned the worktree, so the sibling
    // lookup went looking beside .claude/worktrees.
    process.chdir(linked)
    assert.equal(repoRoot(), real(main))

    // And from a SUBDIRECTORY, which is the other way a CWD-relative guess goes wrong.
    const nested = path.join(linked, 'packages', 'ci-frontend')
    mkdirSync(nested, { recursive: true })
    process.chdir(nested)
    assert.equal(repoRoot(), real(main))
  } finally {
    process.chdir(cwd)
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('repoRoot falls back to the CWD outside a git checkout', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'tokens-sync-nogit-'))
  const cwd = process.cwd()
  try {
    process.chdir(scratch)
    // No repository here, so `git rev-parse` fails and the catch returns the CWD - the
    // caller then reports the missing source file readably rather than throwing.
    assert.equal(repoRoot(), process.cwd())
  } finally {
    process.chdir(cwd)
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('reports a media query whose expected dark block is missing', () => {
  // Restructured sheet: the OS-preference path would silently go unchecked.
  const restructured = `${vendored}
@media (prefers-color-scheme: dark) {
  .something-else { --warn-text: yellow; }
}`
  assert.deepEqual(compare(source, restructured), [
    'dark: @media (prefers-color-scheme: dark) exists but its .ci-page:not([data-theme="light"]) block was not found, so the OS-preference dark tokens are unchecked',
  ])
})
