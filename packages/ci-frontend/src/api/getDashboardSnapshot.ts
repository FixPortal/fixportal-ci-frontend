import { parseDashboardSnapshot } from './parseDashboardSnapshot'
import type { DashboardSnapshot } from './types'

// 204 No Content is the documented "no snapshot yet" state. Return null rather
// than calling response.json() on an empty body. snapshotUrl is the resolved
// URL to fetch — callers compute it from apiBase + /api/dashboard/snapshot or
// from an adminSnapshotUrl override when the viewer is an admin.
export async function getDashboardSnapshot(
  snapshotUrl: string,
  signal?: AbortSignal,
): Promise<DashboardSnapshot | null> {
  const response = await fetch(snapshotUrl, { signal })
  if (response.status === 204) return null
  if (!response.ok) throw new Error(`Dashboard snapshot failed: ${response.status}`)
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('Invalid dashboard snapshot response')
  }
  return parseDashboardSnapshot(body)
}
