# fixportal-ci-frontend

An open-source CI dashboard UI: a React component library plus a runnable
standalone app that render a continuous-integration overview for a GitHub
organisation — workflow status, open pull requests, deploy/package lanes,
per-repo metrics, and a 24-hour CI trend — from a single backend snapshot
endpoint.

It is the presentation layer for the FixPortal CI backend, extracted so it can
be reused independently. The board has no hard dependency on any FixPortal
package: the brand is injectable and the design tokens are vendored, so you can
drop it into your own app or run the bundled dashboard as-is.

> Screenshot: run the standalone app against your CI backend and add a capture
> here (`docs/dashboard.png`). The smoke build renders the "Dashboard
> unavailable" state when no backend is reachable.

## What's in the repo

| Path | What it is |
| --- | --- |
| `packages/ci-frontend` | `@fix-portal/ci-frontend` — the publishable React component library |
| `apps/dashboard` | a thin Vite app that consumes the library via the workspace |

## Quickstart (clone and run)

```bash
git clone https://github.com/FixPortal/fixportal-ci-frontend.git
cd fixportal-ci-frontend
npm install
npm run dev
```

`npm run dev` builds the library and starts the standalone app on
`http://localhost:5173`. Point it at a CI backend by copying
`apps/dashboard/.env.example` to `apps/dashboard/.env` and setting
`VITE_CI_API_BASE` to your backend origin (defaults to
`https://ci.fixportal.org`).

## Using the library in your own app

```bash
npm install @fix-portal/ci-frontend @tanstack/react-query react react-dom
```

`react`, `react-dom`, and `@tanstack/react-query` are peer dependencies — the
library uses your copies, so wrap the board in your own `QueryClientProvider`.

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

### `CiBoard` props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `adminSignal` | `boolean` | (required) | When `true`, private repos and actionable GitHub PR links are shown; when `false`, the board is the public, read-only view. You compute this however your app authenticates. |
| `apiBase` | `string` | `https://ci.fixportal.org` | Origin of the CI backend snapshot API (no trailing slash). |
| `logo` | `ReactNode` | a text wordmark | Brand mark rendered in the header. |
| `footerSlot` | `ReactNode` | a generic footer | Footer content; pass your own to replace the default. |

### Styling

The board consumes ~15 "universal" CSS custom properties (`--text`, `--border`,
`--brand`, `--card-bg`, `--font-sans`, ...). Two ways to supply them:

- **No design system of your own:** import `@fix-portal/ci-frontend/tokens.css`
  (a vendored light + dark token set) **before** `board.css`. Toggle dark mode
  with `document.documentElement.dataset.theme = 'dark'`.
- **You already define those token names:** import only
  `@fix-portal/ci-frontend/board.css` and let your own tokens (and theming) flow
  into the board.

## Backend contract

The board fetches `GET {apiBase}/api/dashboard/snapshot` and expects a JSON
`DashboardSnapshot` (exported as a type from the package). The endpoint is
anonymous and cross-origin. `204 No Content` is the documented "no snapshot
yet" state and renders a waiting message. See `src/api/types.ts` for the full
shape.

## Development

```bash
npm test            # run the library test suite (Vitest)
npm run lint        # ESLint across the workspace
npm run build:lib   # build the library (tsup -> ESM + .d.ts + CSS)
npm run build:app   # type-check and build the standalone app
```

## License

[Apache-2.0](./LICENSE).
