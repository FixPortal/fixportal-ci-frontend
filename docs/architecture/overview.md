# Architecture Overview — `@fix-portal/ci-frontend`

> Derived from the knowledge graphs in `graphify-out/` (agent graph) and
> `.understand-anything/` (human graph). Both are regenerable build artifacts
> (`/graphify --update`, `/understand`) and are git-ignored. This document is the
> hand-curated reading of what those graphs surface — it records the *intent* and
> the *load-bearing seams*, not a file-by-file inventory.

## What this is

An open-source CI dashboard UI for a GitHub organisation: workflow status, open
pull requests, deploy/package lanes, per-repo metrics, and a 24-hour CI trend —
all rendered from a **single backend snapshot endpoint**. It is the presentation
layer for the FixPortal CI backend, extracted so it can be reused independently.
The board has no hard dependency on any FixPortal package: the brand is
injectable and the design tokens are vendored.

Two-tier npm-workspaces monorepo:

| Path | Role |
| --- | --- |
| `packages/ci-frontend` | `@fix-portal/ci-frontend` — the publishable React component library |
| `apps/dashboard` | a thin Vite app that consumes the library via the workspace (the runnable demo + deployable image) |

## The spine (data flow)

```
GET {apiBase}/api/dashboard/snapshot
        │
        ▼
  api/types.ts ............... the API contract — centre of gravity (fan-in ~14-18)
        │                       DashboardSnapshot (whole payload)  ─┐
        │                       RepositorySnapshot[] (per-repo)      │ two tiers
        ▼                                                            │
  api/getDashboardSnapshot.ts  HTTP fetch (204 = "no snapshot yet")  │
  hooks/useDashboardSnapshot.ts  TanStack Query polling;             │
        │                         3 fetcher strategies chosen at     │
        │                         runtime by context (admin / guest / plain URL) ── the auth seam
        ▼                                                            │
  CiBoard.tsx .............. public library entry component          │
        │                     • QueryClientSafeProvider guards against a duplicate
        │                       QueryClient when the host app already has one
        │                     • CiConfigContext + CiAdminContext = DI for apiBase / adminSignal
        ▼                                                            │
  pages/CiBoardContent.tsx . page orchestrator — widest fan-out (~17)│
        │                     public/private repo grouping (buildRepoList)
        ▼                                                            ▼
  components/* ............. board widgets: RepoBoard, SignalChip, CiWeatherBar,
                            PullRequestStepper, RepoMetricsLine, SummaryStrip,
                            RepoSection, JobLaneRow, StatusLegend, MetricsLegend,
                            PullRequestList, RepoActivityIndicator
        │
        ▼ (consume RepositorySnapshot + pure helpers)
  lib/* ................... pure derivation helpers: computeSummary, flattenOpenPrs,
                            isNoCi, prAgeTone, worstState, dedupeJobLabel, stateLabel,
                            formatCompactNumber, relativeTime, isAllowedHref
```

## Load-bearing seams (what the graph gets right)

- **`api/types.ts` is the real centre of gravity**, not any component. It is the
  most-imported file (fan-in ~14 in-repo, ~18 across the graph). Everything else
  is a consumer of the contract it defines. Change a shape here and the blast
  radius is the whole board.
- **The snapshot type is two-tiered, and both tiers are load-bearing:**
  `DashboardSnapshot` is the whole payload consumed at the app-shell tier
  (`CiBoard` → `getDashboardSnapshot` → `useDashboardSnapshot`);
  `RepositorySnapshot[]` is the per-repo tier that fans into `RepoBoard` and the
  pure derivation helpers (`computeSummary`, `flattenOpenPrs`, `isNoCi`,
  `RepoActivityIndicator`). Treat them as the two stable interfaces of the lib.
- **The auth/visibility seam lives in `useDashboardSnapshot`**, which selects one
  of three fetcher strategies (admin fetcher, guest fetcher, plain URL) at
  runtime from context. `adminSignal` flows in through `CiAdminContext`; when
  `true`, private repos and actionable GitHub PR links are shown.
- **"Library, not app" tension is encoded in `QueryClientSafeProvider`** — it
  avoids creating a second TanStack `QueryClient` when the host application
  already provides one. This is the seam that makes the board droppable into a
  foreign app.
- **Styling is injection, not import-coupling.** The board consumes ~15 universal
  CSS custom properties; `tokens.css` (vendored light+dark) and `board.css` are
  shipped as separate distributed artifacts so a host with its own design system
  imports only `board.css`. The brand mark and footer are `ReactNode` props.

## Structural findings worth recording (what raw ranking gets wrong)

- **`relativeTime()` is a false god node.** It ranks high on degree (fan-in ~7,
  imported by `CiWeatherBar`, `SummaryStrip`, `PullRequestStepper`, ...), but it
  is a pure leaf formatter with zero outbound edges and no architectural weight —
  the same pattern as `useDocumentTitle` in the simulator frontend. High degree ≠
  load-bearing. Do not mistake it for a hub.
- **`isAllowedHref()` is a small but cross-cutting security guard** — an XSS guard
  (blocks `javascript:`/`data:` link injection) called from ~4 component sites.
  Worth tracking precisely *because* it is small and easy to forget when adding a
  new external link.
- **`CiBoardContent.tsx` is the genuine orchestration hub** (widest fan-out ~17):
  it wires every hook and widget together and owns the public/private grouping
  logic. This is the file to read first to understand how the board assembles.
- **No import cycles** detected across the library.
- The 12 board widgets and several leaf components use explicit `React.memo` to
  skip re-renders on no-change TanStack Query poll ticks — a deliberate
  performance pattern, not incidental.

## Layers (from the understand-anything graph)

1. **Library Core** — `api/types.ts`, `api/getDashboardSnapshot.ts`, all 10 `lib/` pure helpers
2. **Library Hooks** — `useDashboardSnapshot`, `useCollapseState`, `useHideNoCi`
3. **Library Components** — 12 board widgets, `pages/CiBoardContent`, the root entry files (`CiBoard`, `CiAdminContext`, `CiConfigContext`, `DefaultFooter`, `index.ts` barrel)
4. **Library Styles** — `board.css`, `tokens.css`
5. **Dashboard App** — `apps/dashboard` source, HTML shell, app configs
6. **Infrastructure** — `Dockerfile` (multi-stage Node build → nginx serve), `docker-entrypoint.sh` (envsubst nginx template), `nginx.conf.template`, `ci.yml`, `release.yml`
7. **Project Configuration** — root + library build configs (`package.json` ×2, `tsconfig` ×2, `tsup`, `vitest`, `eslint`, `.npmrc`, `.gitattributes`) + `README.md`

## Packaging & deploy

- **Build:** `tsup` emits ESM + `.d.ts` + CSS for the library; `index.ts` is the
  public barrel / export surface. The app is built with Vite.
- **Container:** multi-stage `Dockerfile` (Node 22 Alpine build → nginx Alpine
  serve, port 8080, non-root). `docker-entrypoint.sh` runs `envsubst` over
  `nginx.conf.template` so `BACKEND_URL` / `VITE_CI_API_BASE` are injected at
  container start.
- **CI/CD:** `ci.yml` lints, tests (Vitest), builds lib + app, and pushes the
  image to GHCR on `main`. `release.yml` publishes the npm package (OIDC
  provenance) and the Docker image on `v*` tags.

## Where to start reading

`README.md` → `api/types.ts` (the contract) → `useDashboardSnapshot.ts` (the
fetch + auth seam) → `CiBoard.tsx` (public entry) → `pages/CiBoardContent.tsx`
(orchestration). The `.understand-anything` dashboard tour walks this same path
in 13 steps.
