import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:https'

const root = process.cwd()
const suffix = `${process.pid}-${Date.now()}`
const image = `fixportal-ci-frontend-smoke:${suffix}`
const containers = new Set()
const startupError = 'Error: BACKEND_URL'

function run(command, args, { timeout = 480_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`${command} ${args.join(' ')} timed out after ${timeout}ms\n${stdout}${stderr}`))
    }, timeout)

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

async function mustRun(command, args, options) {
  const result = await run(command, args, options)
  if (result.code !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.code}\n${result.stdout}${result.stderr}`)
  }
  return result.stdout.trim()
}

async function removeContainer(name) {
  await run('docker', ['rm', '--force', name], { timeout: 10_000 }).catch(() => {})
  containers.delete(name)
}

async function assertInvalidStartup(label, value, expectedMessage = startupError) {
  const name = `ci-frontend-invalid-${label}-${suffix}`
  containers.add(name)
  const args = ['run', '--detach', '--name', name]
  if (value !== undefined) args.push('--env', `BACKEND_URL=${value}`)
  args.push(image)

  try {
    await mustRun('docker', args, { timeout: 10_000 })
    const exit = await mustRun('docker', ['wait', name], { timeout: 10_000 })
    const logResult = await run('docker', ['logs', name], { timeout: 10_000 })
    assert.equal(logResult.code, 0, `${label}: could not read container logs`)
    const logs = logResult.stdout + logResult.stderr
    assert.notEqual(Number(exit), 0, `${label}: container unexpectedly exited successfully`)
    assert.ok(logs.includes(expectedMessage), `${label}: startup error missing ${JSON.stringify(expectedMessage)}`)
  } finally {
    await removeContainer(name)
  }
}

// A BACKEND_URL the entrypoint accepts must let nginx come up and serve the
// SPA. The underscore host is resolved via --add-host because proxy_pass takes
// BACKEND_URL literally, so nginx resolves it at startup.
async function assertValidStartup(label, value, extraHosts) {
  const name = `ci-frontend-valid-${label}-${suffix}`
  containers.add(name)
  const args = ['run', '--detach', '--name', name, '--publish', '127.0.0.1::8080']
  for (const host of extraHosts) args.push('--add-host', `${host}:127.0.0.1`)
  args.push('--env', `BACKEND_URL=${value}`, image)

  try {
    await mustRun('docker', args, { timeout: 10_000 })
    const binding = await mustRun('docker', ['port', name, '8080/tcp'], { timeout: 10_000 })
    const port = Number(binding.match(/:(\d+)$/)?.[1])
    assert.ok(port, `${label}: could not parse published port from ${binding}`)
    const response = await waitFor(`http://127.0.0.1:${port}/`, Date.now() + 20_000)
    assert.match(await response.text(), /<div id="root"><\/div>/, `${label}: accepted BACKEND_URL did not serve the SPA`)
  } finally {
    await removeContainer(name)
  }
}

async function waitFor(url, deadline) {
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`container did not become ready: ${lastError?.message ?? 'unknown error'}`)
}

// The upstream's TLS keypair is generated per run into a temp dir rather than
// committed: a checked-in private key, even a self-signed test-only one that
// guards nothing, is a permanent scanner dismissal. Requires openssl on PATH
// (present on the GitHub ubuntu images and any dev box with Git for Windows).
const fixturesDir = await mkdtemp(join(tmpdir(), 'ci-frontend-smoke-'))

// Guarded separately from the main try/finally below. mkdtemp has already created the
// directory by this point, and an openssl that is absent or fails throws PAST that
// finally -- which is what owns `rm(fixturesDir, ...)` -- so every failed run left a
// directory behind. The keypair is a per-run throwaway that guards nothing; the leak is
// the defect, not the material.
let keyPair
try {
  await mustRun('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', join(fixturesDir, 'key.pem'),
    '-out', join(fixturesDir, 'cert.pem'),
    '-days', '1', '-nodes',
    '-subj', '/CN=host.docker.internal',
    '-addext', 'subjectAltName=DNS:host.docker.internal',
  ])
  keyPair = {
    cert: await readFile(join(fixturesDir, 'cert.pem')),
    key: await readFile(join(fixturesDir, 'key.pem')),
  }
} catch (error) {
  await rm(fixturesDir, { recursive: true, force: true }).catch(() => {})
  throw error
}

let upstreamRequest
const upstream = createServer(keyPair, (request, response) => {
  upstreamRequest = {
    url: request.url,
    headers: request.headers,
    httpVersion: request.httpVersion,
    servername: request.socket.servername,
  }
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end('{"ok":true}')
})

try {
  await new Promise((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen(0, '0.0.0.0', resolve)
  })
  const upstreamPort = upstream.address().port
  const paddedUpstreamPort = String(upstreamPort).padStart(6, '0')
  await mustRun('docker', ['build', '--tag', image, '.'])

  await assertInvalidStartup('missing')
  await assertInvalidStartup('trailing-slash', 'https://backend/')
  await assertInvalidStartup('path', 'https://backend/path')
  await assertInvalidStartup('scheme', 'ftp://backend')
  await assertInvalidStartup('injection', 'http://backend; proxy_set_header X-Injected yes')
  await assertInvalidStartup('port-empty', 'http://backend:')
  await assertInvalidStartup('port-alpha', 'http://backend:not-a-port')
  await assertInvalidStartup('port-zero', 'http://backend:0')
  await assertInvalidStartup('port-too-high', 'http://backend:65536')
  // IPv6 is deliberately unsupported; the error must say so, not recite "bare origin".
  await assertInvalidStartup('ipv6-bracketed', 'http://[fd00::1]:8080', 'bracketed IPv6 literals are not supported')
  await assertInvalidStartup('ipv6-bare', 'http://fd00::1', 'an IPv6 literal, which is not supported')

  // Underscores are legal Docker network aliases (compose-derived names) and
  // must be accepted — this was the MED-4 regression.
  await assertValidStartup('underscore-host', 'http://ci_backend:3000', ['ci_backend'])

  const name = `ci-frontend-smoke-${suffix}`
  containers.add(name)
  await mustRun('docker', [
    'run', '--detach', '--name', name,
    '--add-host', 'host.docker.internal:host-gateway',
    '--publish', '127.0.0.1::8080',
    '--env', `BACKEND_URL=https://host.docker.internal:${paddedUpstreamPort}`,
    image,
  ], { timeout: 10_000 })

  const binding = await mustRun('docker', ['port', name, '8080/tcp'], { timeout: 10_000 })
  const containerPort = Number(binding.match(/:(\d+)$/)?.[1])
  assert.ok(containerPort, `could not parse published port from ${binding}`)
  const origin = `http://127.0.0.1:${containerPort}`

  const rootResponse = await waitFor(`${origin}/`, Date.now() + 20_000)
  const rootHtml = await rootResponse.text()
  assert.match(rootHtml, /<div id="root"><\/div>/, 'built SPA entry point is missing')

  const nestedResponse = await fetch(`${origin}/nested/route`, { signal: AbortSignal.timeout(2_000) })
  assert.equal(nestedResponse.status, 200)
  assert.equal(await nestedResponse.text(), rootHtml, 'nested route did not use SPA fallback')

  const apiResponse = await fetch(`${origin}/api/probe?value=1`, { signal: AbortSignal.timeout(2_000) })
  assert.equal(apiResponse.status, 200)
  assert.deepEqual(await apiResponse.json(), { ok: true })
  assert.equal(upstreamRequest?.url, '/api/probe?value=1')
  assert.equal(upstreamRequest?.servername, 'host.docker.internal', 'TLS SNI is missing or incorrect')
  assert.equal(upstreamRequest?.httpVersion, '1.1', 'upstream request is not HTTP/1.1')
  assert.equal(upstreamRequest?.headers.connection, undefined, 'Connection header was forwarded upstream')
  assert.equal(upstreamRequest?.headers.host, `host.docker.internal:${paddedUpstreamPort}`)
  assert.ok(upstreamRequest?.headers['x-forwarded-for'], 'X-Forwarded-For is missing')

  console.log('Production nginx container smoke passed')
} finally {
  for (const name of containers) await removeContainer(name)
  if (upstream.listening) await new Promise((resolve) => upstream.close(resolve))
  await run('docker', ['image', 'rm', '--force', image], { timeout: 30_000 }).catch(() => {})
  await rm(fixturesDir, { recursive: true, force: true }).catch(() => {})
}
