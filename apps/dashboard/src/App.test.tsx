import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('@fix-portal/ci-frontend', () => ({
  CiBoard: ({ adminSignal }: { adminSignal: boolean }) => <output>{String(adminSignal)}</output>,
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
