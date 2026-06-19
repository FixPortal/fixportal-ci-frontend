import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The standalone app has no design system of its own, so it imports BOTH the
// vendored universal tokens and the board styles. A host with its own tokens
// (e.g. the FixPortal simulator) imports only board.css.
import '@fix-portal/ci-frontend/tokens.css'
import '@fix-portal/ci-frontend/board.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
