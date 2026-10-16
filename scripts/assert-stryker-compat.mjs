import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const oldStatement = "return nameParts.join(' ').trim();"
const newStatement = "return nameParts.filter((part) => part !== '').join(' > ').trim();"
export const targets = [
  [
    'test-helpers.js',
    '120ef95f006b5449019155f93c049d888f2c73b525cfd57a9131ebe3d953535e',
    '13db8fafa22afcbdb9370cee12e7ac7070a58e6a4298853a44346f6c9a21106f',
  ],
  [
    'stryker-setup.js',
    '11ea94ed9ba49a916fb0f6cbb365e896f4ce67958009f7a4320ceebaba14febb',
    '400e0e3d5b6b3cc7f1e736ff2d2b301c6231a85b93e1896d6d6a53502c11ded7',
  ],
]
const packages = {
  'packages/ci-frontend/node_modules/@stryker-mutator/core': '10.0.0',
  'packages/ci-frontend/node_modules/@stryker-mutator/vitest-runner': '10.0.0',
  'node_modules/vitest': '5.0.3',
}
const corePath = 'packages/ci-frontend/node_modules/@stryker-mutator/core'
const runnerPath = 'packages/ci-frontend/node_modules/@stryker-mutator/vitest-runner'
const workspacePath = 'packages/ci-frontend'
export const sha = (value) => createHash('sha256').update(value).digest('hex')
function contained(root, candidate) {
  const relative = path.relative(root, candidate)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error(`Path escapes project: ${candidate}`)
  return candidate
}
export function ensureCompatibility(project) {
  const root = fs.realpathSync(project)
  const local = (relative) => contained(root, fs.realpathSync(path.join(root, relative)))
  for (const [relative, expected] of Object.entries(packages)) {
    const actual = JSON.parse(fs.readFileSync(local(`${relative}/package.json`), 'utf8')).version
    if (actual !== expected)
      throw new Error(
        `Unsupported ${relative} ${actual}; expected ${expected}. Review upstream fix and canary before updating.`,
      )
  }
  const runnerRoot = local(runnerPath)
  const resolvedVitest = fs.realpathSync(
    createRequire(path.join(runnerRoot, 'package.json')).resolve('vitest/package.json'),
  )
  if (resolvedVitest !== local('node_modules/vitest/package.json'))
    throw new Error('Unexpected runner-local Vitest resolution')
  // Validate BOTH complete files before writing either. Mixed states never auto-heal.
  const files = targets.map(([name, original, patched]) => {
    const filename = contained(runnerRoot, local(`${runnerPath}/dist/src/${name}`))
    const text = fs.readFileSync(filename, 'utf8')
    const hash = sha(text)
    if (hash !== original && hash !== patched) throw new Error(`Unknown runner hash: ${name}`)
    const statement = hash === original ? oldStatement : newStatement
    if (text.split(statement).length !== 2) throw new Error(`Unexpected statement count: ${name}`)
    return { filename, text, original, patched, hash }
  })
  if (
    files.some((file) => file.hash === file.original) &&
    files.some((file) => file.hash === file.patched)
  )
    throw new Error('Mixed runner patch state')
  for (const file of files) {
    if (file.hash === file.original)
      fs.writeFileSync(file.filename, file.text.replace(oldStatement, newStatement))
    if (sha(fs.readFileSync(file.filename)) !== file.patched)
      throw new Error('Runner post-write hash mismatch')
  }
  return files.map((file) => ({ file: path.basename(file.filename), sha256: file.patched }))
}

// Linux CI only: each owned child gets its own process group, including descendants.
export function boundedRun(args, cwd, env, milliseconds, cap = 1024 * 1024) {
  if (process.platform !== 'linux')
    throw new Error('Mutation compatibility qualification requires Linux')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let bytes = 0
    let failure
    const chunks = []
    let killed = false
    const kill = (reason) => {
      failure ??= new Error(reason)
      if (killed) return
      killed = true
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') failure.cause = error
      }
    }
    const timer = setTimeout(() => kill('Canary deadline exceeded'), milliseconds)
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (data) => {
        bytes += data.length
        if (bytes > cap) kill('Canary output cap exceeded')
        else chunks.push(data)
      })
    child.on('error', (error) => {
      failure ??= error
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const output = Buffer.concat(chunks)
      if (failure) reject(Object.assign(failure, { output }))
      else resolve({ code, output })
    })
  })
}
export function readObserverEvents(sink, output) {
  const noEvents = () => new Error(`Canary observer wrote no events; inspect ${output}/console.log`)
  if (!fs.existsSync(sink)) throw noEvents()
  const lines = fs
    .readFileSync(sink, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
  if (lines.length === 0) throw noEvents()
  return lines.map((line) => JSON.parse(line))
}
export function assertCanary(report, events) {
  const file = report.files['src/required.js']
  const mutants = file?.mutants ?? []
  if (mutants.length > 6) throw new Error('Canary mutation scope expanded')
  const target = mutants.filter(
    (m) =>
      m.mutatorName === 'ConditionalExpression' &&
      m.replacement === 'false' &&
      m.location.start.line === 3 &&
      m.location.start.column === 5 &&
      m.location.end.line === 4 &&
      m.location.end.column === 24,
  )
  if (target.length !== 1 || target[0].status !== 'Killed')
    throw new Error(`Nested canary target must be Killed: ${JSON.stringify(target)}`)
  const names = Object.values(report.testFiles ?? {})
    .flatMap((f) => f.tests ?? [])
    .filter((t) => target[0].killedBy?.includes(t.id))
    .map((t) => t.name)
  if (!names.some((name) => name.includes('reports the literal required error for null')))
    throw new Error('Canary killedBy must identify nested literal assertion')
  const witnessed = events.some(
    (e) =>
      e.phase === 'afterEach' &&
      e.name === 'reports the literal required error for null' &&
      e.state === 'fail' &&
      e.providedMode === 'mutant' &&
      String(e.providedId) === target[0].id &&
      [e.stryker, e.stryker2].some(
        (ns) => String(ns?.activeMutant) === target[0].id && ns.hitCount > 0,
      ),
  )
  if (!witnessed) throw new Error('Missing active nested failing-assertion witness')
  return { target: target[0], killedBy: names }
}
export function ownedDirectory(root, relative) {
  let current = fs.realpathSync(root)
  for (const segment of relative.split('/')) {
    if (!segment || segment === '.' || segment === '..')
      throw new Error('Invalid owned directory segment')
    current = path.join(current, segment)
    if (!fs.existsSync(current)) fs.mkdirSync(current)
    current = contained(root, fs.realpathSync(current))
  }
  return current
}
function removeOwnedCanary(owned, resolved, cache) {
  // The exact path returned by this invocation's mkdtemp is the ownership witness.
  if (fs.realpathSync(owned) !== resolved || path.dirname(resolved) !== fs.realpathSync(cache))
    throw new Error('Canary cleanup ownership mismatch')
  console.log(`Removing current-run canary fixture: ${resolved}`)
  fs.rmSync(resolved, { recursive: true })
}
export async function runCanary(project) {
  const root = fs.realpathSync(project)
  const cache = ownedDirectory(
    root,
    [workspacePath, '.mutation-canary-tmp'].filter(Boolean).join('/'),
  )
  const outputParent = ownedDirectory(
    root,
    [workspacePath, 'reports/mutation-canary'].filter(Boolean).join('/'),
  )
  const owned = fs.mkdtempSync(path.join(cache, 'stryker-canary-'))
  const resolved = fs.realpathSync(owned)
  const output = ownedDirectory(
    root,
    [workspacePath, 'reports/mutation-canary', path.basename(owned)].filter(Boolean).join('/'),
  )
  if (path.dirname(output) !== outputParent) throw new Error('Canary output ownership mismatch')
  try {
    fs.cpSync(path.join(root, 'scripts/fixtures/stryker-canary'), owned, { recursive: true })
    fs.symlinkSync(
      path.join(root, workspacePath, 'node_modules'),
      path.join(owned, 'node_modules'),
      'dir',
    )
    const sink = path.join(output, 'events.jsonl')
    const result = await boundedRun(
      [path.join(root, corePath, 'bin/stryker.js'), 'run', 'stryker.config.json'],
      owned,
      { ...process.env, STRYKER_CANARY_EVENTS: sink },
      60_000,
    )
    fs.writeFileSync(path.join(output, 'console.log'), result.output)
    const reportPath = path.join(owned, 'reports/mutation.json')
    if (!fs.existsSync(reportPath))
      throw new Error(
        `Canary setup produced no report (exit ${result.code}); inspect ${output}/console.log`,
      )
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    fs.copyFileSync(reportPath, path.join(output, 'mutation.json'))
    const events = readObserverEvents(sink, output)
    const receipt = assertCanary(report, events)
    if (result.code !== 0) throw new Error(`Canary runner exit ${result.code}`)
    fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
    console.log(`Nested mutation canary PASS: ${output}`)
  } catch (error) {
    if (error.output) fs.writeFileSync(path.join(output, 'console.log'), error.output)
    throw error
  } finally {
    removeOwnedCanary(owned, resolved, cache)
  }
}
export function runMutation(project, cli) {
  const root = fs.realpathSync(project)
  const executable = contained(
    root,
    fs.realpathSync(cli ?? path.join(root, corePath, 'bin/stryker.js')),
  )
  const child = spawn(process.execPath, [executable, 'run'], {
    cwd: path.join(root, workspacePath),
    stdio: 'inherit',
  })
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    // A signal has no numeric exit code; it must never become a successful wrapper exit.
    child.on('close', (code) => resolve(code ?? 1))
  })
}
async function main() {
  const root = fs.realpathSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
  const mode = process.argv[2]
  if (!['--canary', '--run'].includes(mode) || process.argv.length !== 3)
    throw new Error('Expected --canary or --run')
  ensureCompatibility(root)
  await runCanary(root)
  if (mode === '--run') {
    process.exitCode = await runMutation(root)
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
