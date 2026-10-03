import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CiBoard } from '@fix-portal/ci-frontend'
import type { DashboardSnapshot } from '@fix-portal/ci-frontend'
import '@fix-portal/ci-frontend/tokens.css'
import '@fix-portal/ci-frontend/board.css'

// Test-only consumer of the published API. Playwright intercepts every endpoint;
// this host has no credentials and is never included in the standalone build.
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
async function fetchSnapshot(): Promise<DashboardSnapshot | null> {
  const response = await fetch('/fixture/admin-snapshot')
  if (!response.ok) throw new Error('Admin snapshot unavailable')
  return response.json() as Promise<DashboardSnapshot>
}

export function Consumer() {
  const [admin, setAdmin] = useState(true)
  return <QueryClientProvider client={client}>
    <button type="button" onClick={() => setAdmin(value => !value)}>
      {admin ? 'Switch to guest' : 'Switch to admin'}
    </button>
    <button type="button" onClick={() => { void client.invalidateQueries() }}>Refresh fixture</button>
    <CiBoard adminSignal={admin} adminSnapshotFetcher={fetchSnapshot} storageNamespace="browser-fixture" theme="light"
      mergeFetcher={async (repo, pullNumber, headSha) => {
        const response = await fetch('/fixture/merge', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ repo, pullNumber, headSha }),
        })
        if (!response.ok) return { ok: false, status: response.status, message: await response.text() }
        return { ok: true, sha: (await response.json() as { sha: string }).sha }
      }} />
  </QueryClientProvider>
}

createRoot(document.getElementById('root')!).render(<Consumer />)
