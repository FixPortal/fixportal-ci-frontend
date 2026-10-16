import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { parse } from 'yaml'
import {
  boundedRun,
  ensureCompatibility,
  ownedDirectory,
  readObserverEvents,
  sha,
  targets,
} from './assert-stryker-compat.mjs'

const runnerPath = 'packages/ci-frontend/node_modules/@stryker-mutator/vitest-runner'
const packages = {
  'packages/ci-frontend/node_modules/@stryker-mutator/core': '10.0.0',
  [runnerPath]: '10.0.0',
  'node_modules/vitest': '5.0.3',
}
const originals = targets.map(([name, original]) => {
  const text = fs
    .readFileSync(`${runnerPath}/dist/src/${name}`, 'utf8')
    .replace(
      "return nameParts.filter((part) => part !== '').join(' > ').trim();",
      "return nameParts.join(' ').trim();",
    )
  assert.equal(sha(text), original, 'Unknown installed test input')
  return text
})
const owned = []
afterEach(() => {
  for (const root of owned.splice(0)) {
    assert.ok(path.basename(root).startsWith('owned-stryker-guard-'))
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()))
    console.log(`Removing current-test fixture: ${root}`)
    fs.rmSync(root, { recursive: true })
  }
})
function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'owned-stryker-guard-'))
  owned.push(root)
  for (const [relative, version] of Object.entries(packages)) {
    const dir = path.join(root, relative)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }))
  }
  const files = targets.map(([name], index) => {
    const file = path.join(root, runnerPath, 'dist/src', name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, originals[index])
    return file
  })
  return { root, files }
}
describe('guarded installed runner compatibility', () => {
  it('patches both exact files and is idempotent', () => {
    const { root, files } = fixture()
    ensureCompatibility(root)
    assert.deepEqual(
      files.map((file) => sha(fs.readFileSync(file))),
      targets.map((target) => target[2]),
    )
    assert.equal(ensureCompatibility(root).length, 2)
  })
  it('prevalidates the second complete file before writing the first', () => {
    const { root, files } = fixture()
    fs.appendFileSync(files[1], '// unknown')
    assert.throws(() => ensureCompatibility(root), /Unknown runner hash/)
    assert.equal(sha(fs.readFileSync(files[0])), targets[0][1])
  })
  for (const index of [0, 1])
    it(`rejects mixed patch state ${index}`, () => {
      const { root, files } = fixture()
      ensureCompatibility(root)
      fs.writeFileSync(files[index], originals[index])
      assert.throws(() => ensureCompatibility(root), /Mixed runner patch state/)
      assert.equal(sha(fs.readFileSync(files[index])), targets[index][1])
    })
  it('rejects unsupported Vitest before writing', () => {
    const { root, files } = fixture()
    fs.writeFileSync(path.join(root, 'node_modules/vitest/package.json'), '{"version":"99.0.0"}')
    assert.throws(() => ensureCompatibility(root), /Unsupported/)
    assert.equal(sha(fs.readFileSync(files[0])), targets[0][1])
  })
  it('rejects a shadow Vitest resolved by the actual runner', () => {
    const { root } = fixture()
    const shadow = path.join(root, runnerPath, 'node_modules/vitest')
    fs.mkdirSync(shadow, { recursive: true })
    fs.writeFileSync(path.join(shadow, 'package.json'), '{"version":"5.0.3"}')
    assert.throws(() => ensureCompatibility(root), /Unexpected runner-local Vitest resolution/)
  })
  it('rejects a runner target escaping its module subtree', () => {
    const { root, files } = fixture()
    const outside = path.join(root, 'outside.js')
    fs.writeFileSync(outside, originals[0])
    fs.unlinkSync(files[0])
    fs.symlinkSync(outside, files[0])
    assert.throws(() => ensureCompatibility(root), /Path escapes project/)
    assert.equal(sha(fs.readFileSync(files[1])), targets[1][1])
  })
  for (const parent of ['.mutation-canary-tmp', 'reports'])
    it(`rejects escaping output parent ${parent}`, () => {
      const { root } = fixture()
      const outside = fs.mkdtempSync(
        path.join(fs.realpathSync(os.tmpdir()), 'owned-stryker-guard-'),
      )
      owned.push(outside)
      fs.symlinkSync(outside, path.join(root, parent), 'dir')
      assert.throws(() => ownedDirectory(root, `${parent}/child`), /Path escapes project/)
      assert.deepEqual(fs.readdirSync(outside), [])
    })
})
it('requires the unconditional real canary and protected mutation entrypoint', () => {
  const ci = parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'))
  const job = ci.jobs.build
  const steps = job.steps
  const install = steps.findIndex((step) => step.run?.trim() === 'npm ci --ignore-scripts')
  assert.ok(install >= 0)
  const canaries = steps.filter(
    (step) => step.run === 'node scripts/assert-stryker-compat.mjs --canary',
  )
  assert.equal(canaries.length, 1)
  assert.ok(steps.indexOf(canaries[0]) > install)
  assert.equal(canaries[0].if, undefined)
  assert.equal(canaries[0]['continue-on-error'], undefined)
  assert.equal(job.if, undefined)
  assert.equal(job['continue-on-error'], undefined)
  assert.ok(ci.jobs['ci-gate'].needs.includes('build'))
  const manifest = JSON.parse(fs.readFileSync('packages/ci-frontend/package.json', 'utf8'))
  assert.equal(
    manifest.scripts['test:mutation'],
    'node ../../scripts/assert-stryker-compat.mjs --run',
  )
  const workflow = parse(fs.readFileSync('.github/workflows/mutation.yml', 'utf8'))
  const mutation = workflow.jobs['stryker-ci-frontend']
  assert.equal(mutation['timeout-minutes'], 60)
  assert.ok(
    mutation.steps.some(
      (step) =>
        step.run === 'npm run test:mutation -w @fix-portal/ci-frontend' &&
        step.if === undefined &&
        step['continue-on-error'] === undefined,
    ),
  )
})

for (const [label, body, expected] of [
  ['zero', 'process.exitCode = 0', 0],
  ['nonzero', 'process.exitCode = 7', 7],
  ['signal', "process.kill(process.pid, 'SIGTERM')", 1],
]) {
  it(`propagates actual full-run ${label} child exit`, async () => {
    const { root } = fixture()
    const cli = path.join(root, 'owned-cli.mjs')
    const driver = path.join(root, 'owned-driver.mjs')
    fs.writeFileSync(cli, body)
    const production = pathToFileURL(path.resolve('scripts/assert-stryker-compat.mjs')).href
    fs.writeFileSync(
      driver,
      `import { runMutation } from ${JSON.stringify(production)};
process.exitCode = await runMutation(${JSON.stringify(root)}, ${JSON.stringify(cli)});
`,
    )
    const result = await boundedRun([driver], process.cwd(), process.env, 5_000)
    assert.equal(result.code, expected, result.output.toString('utf8'))
  })
}

for (const [label, content] of [
  ['missing', null],
  ['empty', ''],
  ['blank', ' \n\n'],
]) {
  it(`diagnoses ${label} observer events explicitly`, () => {
    const { root } = fixture()
    const sink = path.join(root, 'events.jsonl')
    if (content !== null) fs.writeFileSync(sink, content)
    assert.throws(() => readObserverEvents(sink, root), /Canary observer wrote no events; inspect/)
  })
}
it('ignores blank lines between actual observer events', () => {
  const { root } = fixture()
  const sink = path.join(root, 'events.jsonl')
  fs.writeFileSync(sink, '\n {"state":"fail"}\n \n{"state":"pass"}\n')
  assert.deepEqual(readObserverEvents(sink, root), [{ state: 'fail' }, { state: 'pass' }])
})
it('signals an over-cap child group once and preserves its first failure and cause', async () => {
  const { root } = fixture()
  const cli = path.join(root, 'owned-cli.mjs')
  const driver = path.join(root, 'owned-driver.mjs')
  fs.writeFileSync(
    cli,
    "process.stdout.write('x'.repeat(65536)); setInterval(() => process.stdout.write('x'.repeat(65536)), 1)",
  )
  const production = pathToFileURL(path.resolve('scripts/assert-stryker-compat.mjs')).href
  fs.writeFileSync(
    driver,
    `import assert from 'node:assert/strict';
import { boundedRun } from ${JSON.stringify(production)};
const original = process.kill;
let calls = 0;
const denied = Object.assign(new Error('owned injected kill error'), { code: 'EPERM' });
process.kill = (pid, signal) => {
  calls++;
  original(pid, signal);
  throw denied;
};
try {
  await assert.rejects(boundedRun([${JSON.stringify(cli)}], ${JSON.stringify(root)}, process.env, 1000, 1), error => {
    assert.equal(error.message, 'Canary output cap exceeded');
    assert.equal(error.cause, denied);
    return true;
  });
  assert.equal(calls, 1, 'owned group must be signalled once');
} finally { process.kill = original; }
`,
  )
  const result = await boundedRun([driver], process.cwd(), process.env, 5000)
  assert.equal(result.code, 0, result.output.toString('utf8'))
})
