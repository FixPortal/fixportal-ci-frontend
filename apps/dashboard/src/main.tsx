import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The dashboard is a first-party FixPortal frontend, so it takes its tokens from
// the house design system rather than the library's vendored fallback set (which
// exists for external consumers with no design system of their own — see the
// header of packages/ci-frontend/src/styles/tokens.css). dashboard.css carries
// the app-local AA override; board.css must come last (its token contract).
// IBM Plex via @fontsource, the weights board.css declares (400/500/600/700).
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
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
