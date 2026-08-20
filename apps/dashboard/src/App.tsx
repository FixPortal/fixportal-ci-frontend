import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CiBoard } from '@fix-portal/ci-frontend'
import { readAdminSignal } from './readAdminSignal'

const queryClient = new QueryClient()
const apiBase = import.meta.env.VITE_CI_API_BASE ?? ''

export function App() {
  const [adminSignal] = useState(readAdminSignal)
  return (
    <QueryClientProvider client={queryClient}>
      <CiBoard adminSignal={adminSignal} apiBase={apiBase} />
    </QueryClientProvider>
  )
}
