// Admin is opt-in: only an explicit ?admin=true (persisted) grants it. An absent
// key resolves to guest — never default to admin. This is a presentation toggle
// only; private-repo confidentiality is enforced server-side, not by this flag.
export function readAdminSignal(): boolean {
  const adminParam = new URLSearchParams(window.location.search).get('admin')
  if (adminParam !== null) {
    localStorage.setItem('ci:admin', adminParam)
  }
  return localStorage.getItem('ci:admin') === 'true'
}
