import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function assertReleaseTag(tag, version) {
  const expected = `v${version}`
  if (tag !== expected) throw new Error(`Release tag mismatch: expected ${expected}, received ${tag || '<empty>'}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const packageJson = JSON.parse(await readFile(new URL('../packages/ci-frontend/package.json', import.meta.url)))
  assertReleaseTag(process.env.GITHUB_REF_NAME, packageJson.version)
}
