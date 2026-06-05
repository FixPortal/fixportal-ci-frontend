import type { DashboardSnapshot } from './types'

// 204 No Content is the documented "no snapshot yet" state. Return null rather
// than calling response.json() on an empty body. apiBase is supplied by the
// caller (from CiConfigContext) so the library makes no build-time env
// assumption; a trailing slash is trimmed so the path never doubles up.
export async function getDashboardSnapshot(apiBase: string): Promise<DashboardSnapshot | null> {
  const base = apiBase.replace(/\/$/, '')
  const response = await fetch(`${base}/api/dashboard/snapshot`)
  if (response.status === 204) return null
  if (!response.ok) throw new Error(`Dashboard snapshot failed: ${response.status}`)
  return response.json()
}
