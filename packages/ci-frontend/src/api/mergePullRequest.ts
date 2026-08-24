// The board's only write path. The endpoint lives on the CI backend (which holds
// the GitHub token and enforces the admin key); the browser never talks to
// GitHub directly. mergeUrl is the resolved `${apiBase}/api/dashboard/merge`,
// mirroring how getDashboardSnapshot receives a resolved snapshotUrl.
// Never throws: every failure mode maps to { ok: false } so callers render an
// inline message rather than relying on try/catch at each call site.
export type MergeResult =
  | { ok: true; sha: string }
  | { ok: false; status: number | null; message: string }

async function errorMessage(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) return 'Not authorised to merge'
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error !== '') return body.error
  } catch {
    // Non-JSON error body — fall through to the generic message.
  }
  return `Merge failed (${response.status})`
}

export async function mergePullRequest(
  mergeUrl: string,
  repo: string,
  pullNumber: number,
): Promise<MergeResult> {
  let response: Response
  try {
    response = await fetch(mergeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo, pullNumber }),
    })
  } catch {
    return { ok: false, status: null, message: 'Network error' }
  }
  if (!response.ok) return { ok: false, status: response.status, message: await errorMessage(response) }
  const body = (await response.json()) as { sha?: unknown }
  return { ok: true, sha: typeof body.sha === 'string' ? body.sha : '' }
}
