# @fix-portal/ci-frontend

React components that render a GitHub organisation's CI overview — workflow
status, open pull requests, deploy lanes, per-repo metrics, a 24-hour trend and
per-PR review signals — from a single backend snapshot endpoint.

No FixPortal-specific dependency and no bundled runtime dependencies. `react`,
`react-dom` and `@tanstack/react-query` are required peer dependencies supplied
by the consuming app.

![FixPortal CI dashboard](https://raw.githubusercontent.com/FixPortal/fixportal-ci-frontend/main/docs/dashboard.png)

## Try it without installing anything

The dashboard runs as a container against a public read-only backend, so you can
see it working with live data before deciding:

```bash
docker run -p 8080:8080 \
  -e BACKEND_URL=https://ci.fixportal.org \
  ghcr.io/fixportal/fixportal-ci-frontend:latest
```

Then open <http://localhost:8080>.

To point a dashboard at **your own** GitHub organisation, see
[the setup guide](https://github.com/FixPortal/fixportal-ci-frontend/blob/main/docs/setup-guide.md)
— it assumes no prior knowledge.

## Install

```bash
npm install @fix-portal/ci-frontend @tanstack/react-query react react-dom
```

## Use

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CiBoard } from '@fix-portal/ci-frontend'

// If you have no design system of your own, import both stylesheets:
import '@fix-portal/ci-frontend/tokens.css'
import '@fix-portal/ci-frontend/board.css'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CiBoard adminSignal={false} apiBase="https://ci.example.org" />
    </QueryClientProvider>
  )
}
```

The board reuses an existing `QueryClientProvider`; when there is none, it
creates an internal client.

### `CiBoard` props

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `adminSignal` | `boolean` | required | Host-computed admin state. Private repos and admin-only controls appear only when this is `true` and an admin snapshot URL or fetcher is configured; safe links in the guest snapshot remain clickable, and this prop is not a security control. |
| `apiBase` | `string` | `''` | Origin of the CI backend (no trailing slash). Empty string uses relative `/api/` URLs — correct behind a proxy. |
| `snapshotFetcher` | `() => Promise<DashboardSnapshot \| null>` | plain fetch | Guest snapshot fetcher for hosts that must attach auth headers. |
| `snapshotCacheKey` | `string` | unset | Stable cache-key override for a custom guest fetcher. Distinct fetcher functions are isolated by default; set this to retain a row across recreated function identities. |
| `adminSnapshotUrl` | `string` | unset | Host proxy URL for the privileged snapshot. Add `X-Admin-Key` server-side; never expose it to the browser. |
| `adminSnapshotFetcher` | `() => Promise<DashboardSnapshot \| null>` | unset | Authenticated admin fetcher; takes precedence over `adminSnapshotUrl`. |
| `adminSnapshotCacheKey` | `string` | unset | Stable cache-key override for a custom admin fetcher; it has the same behavior as `snapshotCacheKey`. |
| `mergeFetcher` | `(repo: string, pullNumber: number) => Promise<MergeResult>` | unset | Authenticated callback for a single rebase merge. Keep credentials server-side and return a `MergeResult`. |
| `logo` | `ReactNode` | text wordmark | Brand mark in the dashboard header. |
| `footerSlot` | `ReactNode` | generic footer | Footer content. |
| `storageNamespace` | `string` | unset | Suffix for local-storage keys and the skip-link target, preventing collisions between boards on one origin. |
| `repositoryScope` | `string` | unset | Canonical `owner/repository` identity that limits the board to one already-authorised repository. |
| `showThemeSwitcher` | `boolean` | `true` | Shows the board's Light / Dark / System selector. |

### Styling

The board reads ~15 CSS custom properties (`--text`, `--border`, `--brand`,
`--card-bg`, `--font-sans`, ...).

| Your situation | What to import |
|---|---|
| No existing design system | `tokens.css` before `board.css` — a vendored light/dark token set is included |
| You already define those property names | `board.css` only — your tokens flow in automatically |

The built-in Light / Dark / System selector applies `data-theme` to the board's
own `.ci-page` container, leaving the host page untouched. Hide it with
`showThemeSwitcher={false}` when the host provides its own board-local control.

## Backend contract

The board fetches `GET {apiBase}/api/dashboard/snapshot` and expects a
`DashboardSnapshot` JSON object (type exported from this package). When the
default fetch path calls a cross-origin endpoint, it must be anonymous and
CORS-accessible. A custom `snapshotFetcher` may authenticate according to its
own backend contract. `204 No Content` is the documented "no snapshot yet"
state, and the board renders a waiting message.

The companion backend that produces it is
[`fixportal-ci-backend`](https://github.com/FixPortal/fixportal-ci-backend).

## Two things that catch people out

**Testing under jsdom.** `CiBoard` measures its own header and reads the user's
colour-scheme preference, and jsdom implements neither API. A test that renders
it throws `ResizeObserver is not defined`, then
`window.matchMedia is not a function`. Both need stubbing in your test setup —
[full snippet in the repo README](https://github.com/FixPortal/fixportal-ci-frontend#testing-a-page-that-contains-the-board).
Neither is needed in a real browser.

**TypeScript and the CSS imports.** If your bundler supplies ambient CSS module
types (Vite does, via `vite/client`) the stylesheet imports type-check as-is.
Without them TypeScript reports `TS2882`; add `declare module '*.css'`.

## Compatibility

| Peer dependency | Required |
|---|---|
| `react` | `>=18` |
| `react-dom` | `>=18` |
| `@tanstack/react-query` | `>=5` |

## Links

- [Repository and full documentation](https://github.com/FixPortal/fixportal-ci-frontend)
- [Changelog](https://github.com/FixPortal/fixportal-ci-frontend/blob/main/packages/ci-frontend/CHANGELOG.md)
  — also shipped inside the package
- [Setup guide for newcomers](https://github.com/FixPortal/fixportal-ci-frontend/blob/main/docs/setup-guide.md)
- [Contributing](https://github.com/FixPortal/fixportal-ci-frontend/blob/main/CONTRIBUTING.md)
  — building from source needs only Node 22+, no tokens or accounts

## License

[Apache-2.0](https://github.com/FixPortal/fixportal-ci-frontend/blob/main/LICENSE)
