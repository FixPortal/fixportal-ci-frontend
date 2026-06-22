# Repo-list filtering — design

**Date:** 2026-06-22
**Component:** `@fix-portal/ci-frontend` — CI dashboard
**Status:** Approved (brainstorm)

## Problem

The dashboard's value grows with the number of repos an org has — and so does the
cost of scanning a long, unfiltered list. Today the only list controls are a
single **Hide No-CI** toggle and automatic Public/Private grouping. An org with
many repos needs to narrow the list by name, CI state, visibility, and PR
activity.

## Goal

Add a composable filter bar under the existing toolbar that narrows the repo list
by four dimensions, all combining with AND. Keep the change additive — no
regression to existing toolbar controls.

## Out of scope (YAGNI)

- Saved/named filter presets.
- Sorting (the list keeps its current order).
- Filtering by metric thresholds, age, language, topic.
- URL-encoded shareable filter state (persistence is local only).

## UI

A new filter bar renders directly under `dashboard__toolbar`, inside the existing
`dashboard__sticky` band so it stays frozen on scroll. Left-to-right:

```
[ Filter repos… ]  Visibility  (Public)(Private)  │  CI Status  (Failing)(Passing)(No-CI)  │  (Has PRs)
```

- **Search box** — substring, case-insensitive, matched against repo name.
- **Visibility** group — labelled cluster, chips `Public` / `Private`.
- **CI Status** group — labelled cluster, chips `Failing` / `Passing` / `No-CI`.
- **Has PRs** — a single unlabelled toggle chip (no group label).
- Groups are separated by a thin vertical divider; each labelled group carries a
  small uppercase label (`Visibility`, `CI Status`).
- The existing **Hide No-CI** button stays exactly where it is (toolbar, right
  side). It is unchanged and layers on top of the new filters via AND.

Chips are multi-select within a group. A selected chip is visually "on"
(Failing uses a red tone, Passing green, others the neutral accent — matching the
existing status palette).

### Guest vs admin

Non-admin viewers only ever see public repos (existing
`repos.filter(r => !r.private)` gate). For them the **Visibility group is hidden
entirely** — there is nothing to filter. Search, CI Status, and Has PRs remain.

## Filter semantics

State shape (the new `useRepoFilters` hook):

| Field | Type | Empty/false means |
|---|---|---|
| `search` | `string` | no name filter |
| `visibility` | `Set<'public' \| 'private'>` | all visibilities |
| `ciStatus` | `Set<'failing' \| 'passing' \| 'no-ci'>` | all CI states |
| `hasOpenPrs` | `boolean` | not filtered by PRs |

Combination rules:

- **Across groups: AND.** A repo must pass every active group to be shown.
- **Within a group: OR.** `{failing, passing}` shows repos in either state.
- **Empty group = no constraint** (shows all), not "show none".
- `hasOpenPrs === true` keeps only repos with ≥1 open PR; `false` is a no-op.
- The existing **Hide No-CI** toggle and the admin/public gate both still apply,
  ANDed with the above. If Hide No-CI is on *and* the `No-CI` chip is selected,
  the result is legitimately empty (consistent AND behaviour) and the empty
  state shows.

### CI state derivation

`ciStatus` maps onto existing helpers:

- `no-ci` → `isNoCi(repo)` (existing `lib/isNoCi.ts`).
- `failing` / `passing` → derived from the repo's worst workflow state via the
  existing `lib/worstState.ts`. Implementation note for the plan: confirm the
  exact state→bucket mapping (e.g. failure/timed_out/cancelled → failing;
  success → passing; and how in-progress/queued are bucketed) against
  `worstState` and `stateLabel` during implementation.

## Architecture

- **`lib/applyRepoFilters.ts`** — pure function
  `applyRepoFilters(repos, filters) => repos`. No React, no storage. Fully unit
  tested (mirrors the existing `lib/*.test.ts` pattern). All filter logic lives
  here so the component stays declarative.
- **`hooks/useRepoFilters.ts`** — owns filter state, persists to `localStorage`
  best-effort, namespaced by `storageNamespace` from `CiConfigContext` exactly
  as `useHideNoCi` does. Returns the filter state plus setters/togglers.
- **`components/RepoFilterBar.tsx`** — presentational. Renders search box, chip
  groups, dividers, labels. Receives state + handlers as props; hides the
  Visibility group when `isAdmin` is false. Memoised.
- **`CiBoardContent.tsx`** — wires the hook, applies `applyRepoFilters` to the
  already-admin-gated repo list inside the existing `visibleRepos` memo chain
  (after `applyNoCiFilter`, so Hide No-CI still composes), and renders
  `<RepoFilterBar>` in the sticky band.

### Data-flow order in `CiBoardContent`

```
snapshot.data.repositories
  → admin/public gate            (repositories memo)
  → applyNoCiFilter (Hide No-CI) (existing)
  → applyRepoFilters (new)       (new memo, deps: prev + filters)
  → visibleRepos                 → grouping / summary / openPrs / stepper
```

All downstream consumers (`computeSummary`, `flattenOpenPrs`, public/private
grouping, the PR stepper, the summary strip) already read from `visibleRepos`,
so they pick up the new filters with no further change. The summary strip
therefore recomputes from the filtered set whenever any filter is active.

## Empty state

When the filter pipeline yields zero repos, show a single state message with a
clear action:

> No repositories match the current filters. **Clear filters**

"Clear filters" resets the new filter state only (it does **not** touch the
Hide No-CI toggle or admin scope). The existing "All repositories are No-CI —
hidden" and "No repositories found" messages remain for their existing cases;
the new message covers the case where repos exist but are filtered out.

## Persistence

Filter state persists to `localStorage` (best-effort, swallow quota/private-mode
errors like `useHideNoCi`). Survives reload. Survives poll ticks because the
filter memo's deps are the stable `snapshot.data` reference plus filter state.

## Error handling

- `localStorage` read/write wrapped in try/catch → silent fallback to defaults.
- Filtering is pure and total over the snapshot; no async, no new failure mode.
- Malformed persisted JSON → ignore and start from defaults.

## Testing

- `applyRepoFilters.test.ts` — unit tests for: empty filters = identity; search
  substring + case-insensitivity; within-group OR; across-group AND; `hasOpenPrs`;
  composition with the Hide No-CI / admin pre-filtered input; empty-result case.
- `useRepoFilters.test.tsx` — persistence round-trip, namespace keying,
  best-effort failure on throwing `localStorage` (mirrors `useHideNoCi.test`).
- `RepoFilterBar.test.tsx` — renders groups; Visibility hidden when not admin;
  chip toggle fires handler; search input wired.
- Extend `CiBoardContent`/`RepoBoard` tests as needed for the empty-state message
  and that grouping/summary follow the filtered set.

## Gate before any push (house rule)

`npx tsc -b --noEmit`, `npx vitest run`, and — since SSR-capable components are
touched — `npx vite build`, all green in the worktree before pushing.

## Versioning

Feature work on a shipped package: a version bump + republish of
`@fix-portal/ci-frontend` follows once merged (currently 1.4.0 → likely 1.5.0,
new backward-compatible feature).
