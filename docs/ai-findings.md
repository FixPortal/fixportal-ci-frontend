# AI Findings Ledger

Durable record of un-dismissable static-analysis findings (GitHub Code Quality,
CodeQL advisories, Copilot "AI Findings") that have no dismiss API/UI. Each
finding is matched here by `file:line` + rule before any re-investigation, so a
by-design or fixed issue does not keep resurfacing.

Statuses: `open` (not yet actioned) · `fixed` (fix committed) · `dismissed`
(judged by-design / false-positive / won't-fix).

| Finding | Status | Reason | Rationale | First seen |
|---|---|---|---|---|
| `packages/ci-frontend/src/pages/CiBoardContent.tsx:30,42` — param `hideNoCiHidden` confusing (repeated "hide") | fixed | — | Renamed param to `isNoCiHidden` in `resolveSummary` and `buildRepoList`. | 2026-06-08 |
| `packages/ci-frontend/src/pages/CiBoardContent.tsx:100,135` — No-CI filter ternary duplicated | fixed | — | Extracted shared `applyNoCiFilter(repos, hidden)` helper used by both the pre-early-return `openPrs` compute and post-guard `visibleRepos`. | 2026-06-08 |
| `packages/ci-frontend/src/pages/CiBoardContent.tsx:144,171` — `[...repoNames, ...sectionKeys]` spread duplicated | fixed | — | Extracted `allCollapsibleKeys` const, reused at both call sites. | 2026-06-08 |
| `packages/ci-frontend/src/hooks/useDashboardSnapshot.ts:12` — `useAdminFetcher` reads like a React hook | fixed | — | Renamed to `shouldUseAdminFetcher` (boolean flag, not a hook call). | 2026-06-08 |
| `packages/ci-frontend/src/hooks/useDashboardSnapshot.ts:13` — `useGuestFetcher` reads like a React hook | fixed | — | Renamed to `shouldUseGuestFetcher`. | 2026-06-08 |
| `packages/ci-frontend/src/hooks/useDashboardSnapshot.ts:14` — `isAdmin && adminSnapshotUrl` is `string \| false`, not boolean | dismissed | won't-fix | Value used only as a ternary condition; truthiness already correct, never escapes as a value. `!!` would be pure churn with no clarity or correctness gain. | 2026-06-08 |
| `docs/architecture/overview.md` — term "false god node" unclear | dismissed | won't-fix | Deliberate graphify god-node vocabulary; the same sentence already spells out "high degree, no architectural weight". Suggested rewrite is wordier with no added clarity. | 2026-06-08 |
| `packages/ci-frontend/src/lib/isAllowedHref.ts` — catch block handles both malformed and relative URLs, relative path lacks test coverage for malformed-but-non-protocol-relative inputs | fixed | — | Extracted `isSafeRelativeHref` helper; relative URL classification (with control-char and backslash rejection) now runs before the try/catch, so the catch block is unambiguously for malformed absolute strings. | 2026-06-11 |
| `packages/ci-frontend/src/lib/isAllowedHref.test.ts` — missing protocol-relative variants (`///evil.com`, `////evil.com`, `// evil.com`, `//\tevil.com`) | fixed | — | Added all four variants to the protocol-relative rejection test. | 2026-06-11 |
| `packages/ci-frontend/src/lib/isAllowedHref.test.ts` — no test for `null` input | fixed | — | Added `null` case; function signature widened to `string \| undefined \| null`. | 2026-06-11 |
| `packages/ci-frontend/src/components/SummaryStrip.tsx` — inline prop type, no named interface | fixed | — | Extracted `SummaryStripProps` type above `labelFor`. | 2026-06-11 |
| `packages/ci-frontend/src/components/SummaryStrip.tsx:95` — className built with nested template ternaries | fixed | — | Replaced with `['summary-panel', isReview && '...', isCiStatus && '...'].filter(Boolean).join(' ')`. | 2026-06-11 |
| `packages/ci-frontend/src/components/SummaryStrip.tsx:131` — `href` should re-validate `isAllowedHref` result with secondary URL parse | dismissed | false-positive | `isAllowedHref` is purpose-built to return only `#`, same-origin relative paths, or validated http/https URLs; a second `new URL()` parse in the component adds no safety and obscures intent. | 2026-06-11 |
| `packages/ci-frontend/src/components/CiWeatherBar.tsx:15-16` — two `filter` passes; use single `reduce` | dismissed | won't-fix | Array is fixed at ≤24 elements; O(2n) vs O(n) is imperceptible. Two-line form is clearer than a four-line `reduce`. | 2026-06-11 |
| `packages/ci-frontend/src/components/CiWeatherBar.tsx:25` — React key uses array index instead of `b.bucketStart` | fixed | — | Changed `key={i}` to `key={b.bucketStart}`; index removed from `map` callback. | 2026-06-11 |
