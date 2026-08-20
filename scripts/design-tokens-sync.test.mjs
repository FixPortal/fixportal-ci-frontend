import test from 'node:test'
import assert from 'node:assert/strict'

import { compare } from './design-tokens-sync.mjs'

const source = `:root { --app-bg: white; --card-bg: white; --border: grey; --border-strong: grey; --text: black; --text-muted: grey; --text-faint: grey; --brand: teal; --ok-border: green; --bad-solid: red; --bad-text: red; --warn-text: amber; --warn-fill-deep: amber; --font-sans: sans; --font-mono: mono; }
:root[data-theme="dark"], [data-theme="dark"] { --app-bg: black; --card-bg: black; --border: grey; --border-strong: grey; --text: white; --text-muted: silver; --text-faint: silver; --warn-text: yellow; }`

const vendored = `:root { --app-bg: white; --card-bg: white; --border: grey; --border-strong: grey; --text: black; --text-muted: #5f6472; --text-faint: grey; --brand: teal; --ok-border: green; --bad-solid: red; --bad-text: red; --warn-text: amber; --warn-fill-deep: amber; --font-sans: sans; --font-mono: mono; }
.ci-page[data-theme="dark"] { --app-bg: black; --card-bg: black; --border: grey; --border-strong: grey; --text: white; --text-muted: silver; --text-faint: silver; --warn-text: #f0abfc; }`

test('accepts the deliberate frontend token overrides', () => {
  assert.deepEqual(compare(source, vendored), [])
})

test('reports an unexpected token drift', () => {
  assert.deepEqual(compare(source, vendored.replace('--app-bg: white', '--app-bg: pink')), [
    'light --app-bg: expected white, found pink',
  ])
})
