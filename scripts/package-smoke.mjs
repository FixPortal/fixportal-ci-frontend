import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const temp = await mkdtemp(join(tmpdir(), 'ci-frontend-consumer-'))

try {
  execFileSync('npm', ['run', 'build:lib'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  execFileSync('npm', ['pack', '-w', '@fix-portal/ci-frontend', '--pack-destination', temp], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })

  const tarball = join(temp, (await readdir(temp)).find((file) => file.endsWith('.tgz')) ?? '')
  if (!tarball.endsWith('.tgz')) throw new Error('npm pack did not create a tarball')

  const consumer = join(temp, 'consumer')
  await cp(join(root, 'test', 'package-consumer'), consumer, { recursive: true })
  const manifestPath = join(consumer, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.dependencies['@fix-portal/ci-frontend'] = `file:${tarball}`
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  execFileSync('npm', ['install'], { cwd: consumer, stdio: 'inherit', shell: process.platform === 'win32' })
  execFileSync('npm', ['run', 'typecheck'], { cwd: consumer, stdio: 'inherit', shell: process.platform === 'win32' })
  execFileSync('npm', ['run', 'build'], { cwd: consumer, stdio: 'inherit', shell: process.platform === 'win32' })
} finally {
  await rm(temp, { recursive: true, force: true })
}
