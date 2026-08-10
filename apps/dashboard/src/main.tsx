import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The dashboard is a first-party FixPortal frontend, so it takes its tokens from
// the house design system rather than the library's vendored fallback set (which
// exists for external consumers with no design system of their own — see the
// header of packages/ci-frontend/src/styles/tokens.css). dashboard.css carries
// the IBM Plex @font-face block (fonts preloaded from public/fonts/ via
// index.html); board.css must come last (its token contract).
import '@fixportal/design/tokens.css'
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
