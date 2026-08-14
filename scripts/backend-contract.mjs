import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const fixture = process.argv[2]
if (!fixture) throw new Error('usage: npm run test:backend-contract -- <fixture-path>')
const result = spawnSync(
  'npm',
  ['run', 'test:backend-contract', '-w', '@fix-portal/ci-frontend'],
  {
    env: { ...process.env, BACKEND_SNAPSHOT_FIXTURE: resolve(fixture) },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)
process.exit(result.status ?? 1)
