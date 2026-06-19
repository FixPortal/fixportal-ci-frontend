import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CiBoard } from '@fix-portal/ci-frontend'

const queryClient = new QueryClient()
const apiBase = import.meta.env.VITE_CI_API_BASE ?? ''

// Admin is opt-in: only an explicit ?admin=true (persisted) grants it. An absent
// key resolves to guest — never default to admin. This is a presentation toggle
// only; private-repo confidentiality is enforced server-side, not by this flag.
function readAdminSignal(): boolean {
  const adminParam = new URLSearchParams(window.location.search).get('admin')
  if (adminParam !== null) {
    localStorage.setItem('ci:admin', adminParam)
  }
  return localStorage.getItem('ci:admin') === 'true'
}

export function App() {
  const [adminSignal] = useState(readAdminSignal)
  return (
    <QueryClientProvider client={queryClient}>
      <CiBoard adminSignal={adminSignal} apiBase={apiBase} />
    </QueryClientProvider>
  )
}
