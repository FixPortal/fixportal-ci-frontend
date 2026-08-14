# @fix-portal/ci-frontend

React components that render a GitHub organisation's CI overview — workflow
status, open pull requests, deploy lanes, per-repo metrics, a 24-hour trend and
per-PR review signals — from a single backend snapshot endpoint.

No FixPortal-specific dependency, and **zero runtime dependencies**: `react`,
`react-dom` and `@tanstack/react-query` are peer dependencies, so the library
uses your copies.

![FixPortal CI dashboard](https://raw.githubusercontent.com/FixPortal/fixportal-ci-frontend/main/docs/dashboard.png)

## Try it without installing anything

The dashboard runs as a container against a public read-only backend, so you can
see it working with live data before deciding:

```bash
docker run -p 8080:8080 \
  -e BACKEND_URL=https://fixportal-ci-backend.happycoast-d46c800d.uksouth.azurecontainerapps.io \
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

Wrap the board in your existing `QueryClientProvider` if you already have one.

### `CiBoard` props

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `adminSignal` | `boolean` | required | `true` shows private repos and actionable PR links; `false` is the public read-only view. Derive from your app's auth state — it is a display switch, not a security control; the backend decides what it will serve. |
| `apiBase` | `string` | `''` | Origin of the CI backend (no trailing slash). Empty string uses relative `/api/` URLs — correct behind a proxy. |
| `logo` | `ReactNode` | text wordmark | Brand mark in the dashboard header. |
| `footerSlot` | `ReactNode` | generic footer | Footer content. |

### Styling

The board reads ~15 CSS custom properties (`--text`, `--border`, `--brand`,
`--card-bg`, `--font-sans`, ...).

| Your situation | What to import |
|---|---|
| No existing design system | `tokens.css` before `board.css` — a vendored light/dark token set is included |
| You already define those property names | `board.css` only — your tokens flow in automatically |

Dark mode: `document.documentElement.dataset.theme = 'dark'`.

## Backend contract

The board fetches `GET {apiBase}/api/dashboard/snapshot` and expects a
`DashboardSnapshot` JSON object (type exported from this package). The endpoint
must be anonymous and CORS-accessible. `204 No Content` is the documented
"no snapshot yet" state, and the board renders a waiting message.

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
