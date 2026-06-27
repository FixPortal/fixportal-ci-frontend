# Legend + Scope Header Redesign

**Date:** 2026-06-27
**Status:** Approved

## Problem

Two independent issues with the CI board header/footer:

1. `StatusLegend` and `MetricsLegend` render as `<footer>` elements below the full repo list. With many repos they scroll off the page, making the key unreachable without scrolling to the bottom. The frozen sticky header limits available real estate so moving them there naively doesn't work.

2. The scope text in `.dashboard__scope` (`"FixPortal · all repositories"` / `"public repositories"`) is static — it does not update when the filter bar or Hide No-CI toggle is active, so it contradicts the visible board state.

## Solution Overview

Replace the footer legends with a collapsible row at the base of the sticky header, and make the scope text reflect the active filter state.

---

## 1. Collapsible Legend Row

### Placement

A new row appended inside `.dashboard__sticky`, directly below `SummaryStrip`. The row is **collapsed by default** — zero height cost on initial load. Toggle state is ephemeral (no localStorage; it is reference information, not a user preference).

### Toggle

A `Legend ▾` / `Legend ▴` button controls visibility. The button sits flush-left at the top of the row area, consistent with the toolbar's left-aligned scope text.

### Content when expanded

Two rows:

**Status row** (single line):

```
Status    ● passing  ■ failing  ◎ running  ○ unknown  ○ No-CI  ·  CI = workflow runs · CD = deploys & packages
```

Shape cues are preserved (circle = passing/running/unknown, square = failing) so the key reads correctly in grayscale.

**Lizard metrics rows** (header + definition line):

```
Lizard metrics
              NLOC non-comment lines  ·  avg CCN cyclomatic complexity  ·  functions count  ·  complex functions over CCN 15
```

The header label sits on its own line. The definition line is indented beneath it. Wording retains enough detail for a reader unfamiliar with CCN (the word "cyclomatic" is searchable) without reproducing the full original prose.

### Removed

`<StatusLegend />` and `<MetricsLegend />` are deleted from `CiBoardContent.tsx` and their source files removed. The `.status-legend` and `.metrics-legend` CSS blocks are also removed.

### Files affected

| File | Change |
|---|---|
| `packages/ci-frontend/src/pages/CiBoardContent.tsx` | Remove `<StatusLegend />`, `<MetricsLegend />` imports + JSX; add `<LegendRow />` inside `.dashboard__sticky` |
| `packages/ci-frontend/src/components/LegendRow.tsx` | New component — toggle state + expanded content |
| `packages/ci-frontend/src/components/StatusLegend.tsx` | Delete |
| `packages/ci-frontend/src/components/MetricsLegend.tsx` | Delete |
| `packages/ci-frontend/src/styles/board.css` | Remove `.status-legend`, `.metrics-legend` blocks; add `.legend-row` styles |

---

## 2. Dynamic Scope Text

### Behaviour

| State | Scope text |
|---|---|
| No filters active, Hide No-CI off | `FixPortal · all repositories` (admin) / `FixPortal · public repositories` (non-admin) — unchanged |
| Filter bar active OR Hide No-CI hidden | `FixPortal · X of Y repositories` |

`X` = `visibleRepos.length` — repos currently visible after both the filter bar and Hide No-CI are applied.

`Y` = `snapshot.data.repos.length` — total repos in the snapshot (the full universe before any client-side filtering).

The count portion (`X of Y repositories`) is rendered in the board's accent blue (`--color-accent` / `#3b82f6`) to signal it is live/dynamic rather than static label text.

### Trigger condition

```ts
const isScopeFiltered = filters.isActive || hideNoCi.hidden
```

Both signals contribute because both reduce the visible set and both would make the static label misleading.

### Files affected

| File | Change |
|---|---|
| `packages/ci-frontend/src/pages/CiBoardContent.tsx` | Update `.dashboard__scope` render logic |
| `packages/ci-frontend/src/styles/board.css` | Add `.dashboard__scope-count` colour rule |

---

## What is not changing

- The sticky header structure, `RepoFilterBar`, and `SummaryStrip` are untouched.
- The Hide No-CI toggle button is untouched.
- The dashboard theming control is intentionally left as-is (the board is a standalone SWA; independent theme state per surface is correct behaviour).
- The per-metric hover tooltips on Lizard metric values in repo cards are out of scope.

---

## Test cases

- Legend is collapsed on first load; toggle opens and closes it.
- Expanded legend renders both rows correctly at typical viewport widths (1280px+).
- Definition line wraps gracefully at narrower widths rather than overflowing.
- Scope text shows static label when no filters are active and Hide No-CI is off.
- Scope text switches to count when any filter chip is active.
- Scope text switches to count when Hide No-CI is toggled on.
- Scope text reverts to static label when all filters are cleared and Hide No-CI is off.
- Count `X` matches the number of repo cards rendered on screen.
