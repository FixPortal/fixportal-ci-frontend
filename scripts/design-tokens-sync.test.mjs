import test from 'node:test'
import assert from 'node:assert/strict'

import { compare } from './design-tokens-sync.mjs'

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
