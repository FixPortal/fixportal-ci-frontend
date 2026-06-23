# AI Findings Ledger

Un-dismissable static-analysis findings (GitHub Code Quality, CodeQL, Copilot AI Findings).
Substitute for the missing dismiss UI — match by `file:line` + rule before re-investigating.

| Finding | Status | Reason | Rationale | First seen |
|---|---|---|---|---|
| `apps/dashboard/src/App.tsx:12` react-doctor url-prefilled-privileged-action | dismissed | false-positive | `?admin` is presentation-only; real authz enforced server-side (documented in code comment + CLAUDE.md) | 2026-06-23 |
| `packages/ci-frontend/src/styles/tokens.css` a11y color-contrast `--text-faint` dark mode | fixed | | `#64748b` on `#020617` was ~4.23:1 (<4.5:1 AA); bumped dark-mode `--text-faint` to `#94a3b8` (~7.4:1) in both `[data-theme="dark"]` and `prefers-color-scheme: dark` blocks | 2026-06-23 |
| `packages/ci-frontend/src/components/RepoBoard.tsx:34-35` perf `isAllowedHref` called twice | fixed | | Hoisted to `const ghHref` so URL is parsed once per render | 2026-06-23 |
| `packages/ci-frontend/src/components/SummaryStrip.tsx:68` perf `new Map` rebuilt every render | fixed | | Wrapped in `useMemo([summary])` | 2026-06-23 |
| `packages/ci-frontend/src/hooks/useRepoFilters.ts:79` perf unnecessary `useMemo` on boolean | fixed | | Dropped `useMemo`; inlined the boolean expression (cheap comparison, no allocation) | 2026-06-23 |
| `packages/ci-frontend/src/lib/computeSummary.ts:34-54` perf multiple `.filter()` passes | open | | Multiple single-purpose `.filter()` calls could be one loop; Low-impact micro-opt, code is clear and correct as-is | 2026-06-23 |
| `packages/ci-frontend/src/components/CiWeatherBar.tsx:15-16` perf multiple `.filter()` passes | open | | Same pattern as computeSummary; Low-impact micro-opt | 2026-06-23 |
| `packages/ci-frontend/src/components/SummaryStrip.tsx:81-82` perf passive event listeners | open | | `mousedown`/`keydown` listeners added without `{ passive: true }`; `keydown` cannot be passive (it's not a touch/wheel event), `mousedown` could be but offers no measurable gain here | 2026-06-23 |
| `packages/ci-frontend/src/lib/flattenOpenPrs.ts:10` perf `.sort()` mutation + `new Date()` per comparator | open | | `.sort()` mutates input and calls `new Date()` per comparison call; `.toSorted()` + `Date.parse` would be cleaner, but array comes from `.flatMap` (fresh) and list is short | 2026-06-23 |
| `packages/ci-frontend/src/hooks/useCollapseState.ts` perf localStorage writes without debounce | open | | Every toggle synchronously writes localStorage; debounce would help only under rapid fire (collapse-all), which is a rare interaction | 2026-06-23 |
| `packages/ci-frontend/src/hooks/useHideNoCi.ts` perf localStorage writes without debounce | open | | Same as useCollapseState; toggle is a one-shot user gesture, debounce adds no practical benefit | 2026-06-23 |
