import assert from 'node:assert/strict'
import test from 'node:test'

import { assertReleaseTag } from './release-tag.mjs'

test('accepts a tag matching the package version', () => {
  assert.doesNotThrow(() => assertReleaseTag('v2.6.1', '2.6.1'))
})

for (const [tag, received] of [
  ['v2.6.0', 'v2.6.0'],
  ['2.6.1', '2.6.1'],
  ['v2.6.1-beta', 'v2.6.1-beta'],
  ['', '<empty>'],
]) {
  test(`rejects release tag ${received}`, () => {
    assert.throws(
      () => assertReleaseTag(tag, '2.6.1'),
      new Error(`Release tag mismatch: expected v2.6.1, received ${received}`),
    )
  })
}
