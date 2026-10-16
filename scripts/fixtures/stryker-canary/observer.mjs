import fs from 'node:fs'
import { afterEach, beforeEach, inject } from 'vitest'
const sink = process.env.STRYKER_CANARY_EVENTS
if (!sink) throw new Error('Missing canary event sink')
function record(phase, task) {
  const read = (ns) =>
    ns && { activeMutant: ns.activeMutant, hitCount: ns.hitCount, currentTestId: ns.currentTestId }
  const event = {
    phase,
    name: task?.name,
    state: task?.result?.state,
    providedMode: inject('mode'),
    providedId: inject('activeMutant'),
    activation: inject('mutantActivation'),
    stryker: read(globalThis.__stryker__),
    stryker2: read(globalThis.__stryker2__),
  }
  const line = JSON.stringify(event) + '\n'
  const bytes = fs.existsSync(sink) ? fs.statSync(sink).size : 0
  if (bytes + Buffer.byteLength(line) > 32768) throw new Error('Observer cap exceeded')
  fs.appendFileSync(sink, line)
}
record('setup')
beforeEach(({ task }) => record('beforeEach', task))
afterEach(({ task }) => record('afterEach', task))
