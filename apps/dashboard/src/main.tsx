import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tokens come from the library's own published set, not the private house design
// system, so that a clone of this repo builds for anyone — the dashboard app is
// the reference consumer of the same public package an external user installs.
// dashboard.css carries the IBM Plex @font-face block (fonts preloaded from
// public/fonts/ via index.html); board.css must come last (its token contract).
import '@fix-portal/ci-frontend/tokens.css'
import './dashboard.css'
import '@fix-portal/ci-frontend/board.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
