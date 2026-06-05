import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CiBoard, DEFAULT_CI_API_BASE } from '@fix-portal/ci-frontend'

const queryClient = new QueryClient()
const apiBase = import.meta.env.VITE_CI_API_BASE ?? DEFAULT_CI_API_BASE

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CiBoard adminSignal={false} apiBase={apiBase} />
    </QueryClientProvider>
  )
}
