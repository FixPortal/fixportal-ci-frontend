import { execFileSync } from 'node:child_process'
import { copyFile, cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const npmExecPath = process.env.npm_execpath
if (!npmExecPath) throw new Error('npm_execpath is required to run the package smoke')

const runNpm = (args, cwd) => execFileSync(process.execPath, [npmExecPath, ...args], { cwd, stdio: 'inherit' })
const temp = await mkdtemp(join(tmpdir(), 'ci frontend consumer-'))

try {
  runNpm(['run', 'build:lib'], root)
  runNpm(['pack', '-w', '@fix-portal/ci-frontend', '--pack-destination', temp], root)

  const tarball = join(temp, (await readdir(temp)).find((file) => file.endsWith('.tgz')) ?? '')
  if (!tarball.endsWith('.tgz')) throw new Error('npm pack did not create a tarball')

  const consumer = join(temp, 'consumer')
  await cp(join(root, 'test', 'package-consumer'), consumer, { recursive: true })
  await copyFile(tarball, join(consumer, 'ci-frontend.tgz'))

  runNpm(['ci', '--ignore-scripts'], consumer)
  runNpm(['run', 'typecheck'], consumer)
  runNpm(['run', 'build'], consumer)
} finally {
  await rm(temp, { recursive: true, force: true })
}
