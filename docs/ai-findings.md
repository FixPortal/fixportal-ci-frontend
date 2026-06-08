# AI Findings Ledger

Durable record of un-dismissable static-analysis findings (GitHub Code Quality,
CodeQL advisories, Copilot "AI Findings") that have no dismiss API/UI. Each
finding is matched here by `file:line` + rule before any re-investigation, so a
by-design or fixed issue does not keep resurfacing.

Statuses: `open` (not yet actioned) · `fixed` (fix committed) · `dismissed`
(judged by-design / false-positive / won't-fix).

| Finding | Status | Reason | Rationale | First seen |
|---|---|---|---|---|
| `packages/ci-frontend/src/pages/CiBoardContent.tsx:23,35` — param `hideNoCiHidden` confusing (repeated "hide") | open | — | Cosmetic rename to `isNoCiHidden`; deferred, not yet actioned. | 2026-06-08 |
| `packages/ci-frontend/src/pages/CiBoardContent.tsx:100,135` — No-CI filter ternary duplicated | fixed | — | Extracted shared `applyNoCiFilter(repos, hidden)` helper used by both the pre-early-return `openPrs` compute and post-guard `visibleRepos`. | 2026-06-08 |
| `packages/ci-frontend/src/pages/CiBoardContent.tsx:144,171` — `[...repoNames, ...sectionKeys]` spread duplicated | fixed | — | Extracted `allCollapsibleKeys` const, reused at both call sites. | 2026-06-08 |
| `packages/ci-frontend/src/hooks/useDashboardSnapshot.ts:12` — `useAdminFetcher` reads like a React hook | fixed | — | Renamed to `shouldUseAdminFetcher` (boolean flag, not a hook call). | 2026-06-08 |
| `packages/ci-frontend/src/hooks/useDashboardSnapshot.ts:13` — `useGuestFetcher` reads like a React hook | fixed | — | Renamed to `shouldUseGuestFetcher`. | 2026-06-08 |
| `packages/ci-frontend/src/hooks/useDashboardSnapshot.ts:14` — `isAdmin && adminSnapshotUrl` is `string \| false`, not boolean | open | — | No runtime bug (used only as a ternary condition; truthiness coerces). Cosmetic `!!` for clarity; deferred. | 2026-06-08 |
| `docs/architecture/overview.md` — term "false god node" unclear | dismissed | won't-fix | Deliberate graphify god-node vocabulary; the same sentence already spells out "high degree, no architectural weight". Suggested rewrite is wordier with no added clarity. | 2026-06-08 |
