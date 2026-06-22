// Extends Vitest's `expect` with the jest-dom matchers (toBeInTheDocument, etc.).
import '@testing-library/jest-dom/vitest'

// jsdom does not implement matchMedia. Stub it so components that call
// window.matchMedia (e.g. the ThemeSwitcher in CiBoard) don't throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom does not implement ResizeObserver. Stub it so CiBoard's header-height
// measurement effect doesn't throw.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// RTL auto-cleanup requires globals:true in vitest config. This project opts out
// of globals, so we register cleanup explicitly here. Tests that already call
// cleanup() in their own afterEach are unaffected -- a double-call is a no-op.
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(() => { cleanup() })

// jsdom ships <dialog> as throwing "Not implemented" stubs for the imperative
// API. PullRequestStepper calls dialogRef.current.showModal() on mount, so
// without this every dialog-based test renders a closed (hidden) dialog and
// cannot query its contents. Override unconditionally -- the stubs exist but
// throw, so `??=` would skip them. Toggling `open` is enough for tests to see
// the content; close() also emits the `close` event the native element fires.
/* eslint-disable sonarjs/class-prototype -- patching a jsdom built-in is only
   possible via prototype assignment; there is no class to declare into. */
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue?: string) {
  this.open = false
  if (returnValue !== undefined) this.returnValue = returnValue
  this.dispatchEvent(new Event('close'))
}
/* eslint-enable sonarjs/class-prototype */
// jsdom does not fire the native `cancel` event when Escape is pressed inside an
// open modal dialog. Emulate it so Escape-to-close behaviour is testable:
// dispatch a cancelable `cancel` on the top-most open dialog and, unless a
// handler prevents it (the modals call preventDefault + their own onClose),
// close the dialog.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  const dlg = open[open.length - 1]
  if (!dlg) return
  const proceed = dlg.dispatchEvent(new Event('cancel', { cancelable: true }))
  if (proceed) dlg.close()
})
