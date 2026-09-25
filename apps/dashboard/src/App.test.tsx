import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('@fix-portal/ci-frontend', () => ({
  CiBoard: ({ adminSignal, apiBase }: { adminSignal: boolean; apiBase: string }) => (
    <output>
      {String(adminSignal)}
      <span data-testid="api-base">{apiBase}</span>
    </output>
  ),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('App admin state startup', () => {
  it.each([
    ['stored admin state', true, () => localStorage.setItem('ci:admin', 'true')],
    ['admin URL parameter', true, () => window.history.pushState({}, '', '/?admin=true')],
    ['denied localStorage read', false, () => vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })],
    ['denied localStorage write', false, () => {
      window.history.pushState({}, '', '/?admin=true')
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    }],
  ] as const)('passes %s to CiBoard', (_scenario, expected, arrange) => {
    arrange()
    render(<App />)
    expect(screen.getByText(String(expected))).toBeTruthy()
  })
})

describe('App API base URL wiring', () => {
  // apiBase is read from import.meta.env at module scope, so each case must
  // re-import the module after stubbing the env var to observe its effect.
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('passes the configured VITE_CI_API_BASE through to CiBoard', async () => {
    vi.stubEnv('VITE_CI_API_BASE', 'https://ci-backend.example.com')
    vi.resetModules()
    const { App: StubbedApp } = await import('./App')
    render(<StubbedApp />)
    expect(screen.getByTestId('api-base').textContent).toBe('https://ci-backend.example.com')
  })

  it('defaults to the same-origin empty string when VITE_CI_API_BASE is unset', async () => {
    vi.stubEnv('VITE_CI_API_BASE', undefined)
    vi.resetModules()
    const { App: StubbedApp } = await import('./App')
    render(<StubbedApp />)
    expect(screen.getByTestId('api-base').textContent).toBe('')
  })
})
