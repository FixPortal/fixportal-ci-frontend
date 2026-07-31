# PR review status pills — design

**Date:** 2026-07-31
**Component:** `@fix-portal/ci-frontend` (display) and `fixportal-ci-backend` (data)
**Status:** Approved

## Problem

An open pull request on the board shows number, title, author, age and draft
state. It says nothing about whether the reviewers that gate it have run, or
whether anything is still outstanding. Answering "is #181 clear to merge?"
means leaving the board and opening the PR on GitHub.

The signal exists — CodeRabbit and Gitar post review threads, CodeQL raises
code-scanning alerts — but neither repo fetches or carries it today.

## Goal

Render a small row of per-reviewer pills on a pull request, each showing
whether that reviewer is required here, has outstanding items, is verified
clean, or has not run yet.

## Constraints

- `@fix-portal/ci-frontend` is display-only and Apache-2.0. It must not learn
  FixPortal's review policy: no hardcoded reviewer names, no hardcoded
  `review-high` label.
- The published package and the deployed backend version independently. Neither
  side may break when paired with an older peer.
- The backend PAT budget is 5,000 requests/hour. The 20-second board refresh
  must not slow down or fail because of this feature.
- Dependency PRs are out of AI code review by standing policy, so they must not
  carry reviewer pills.
- A reviewer that has not run must never render as clean. A paused Gitar is
  silent, and silence is not a pass.

## Approaches considered

### 1. Per-repo GraphQL batch on a slow enrichment worker (selected)

One GraphQL query per repo per cycle covering all its open PRs, plus one REST
call for that repo's open code-scanning alerts, on a 150-second worker separate
from the 20-second board refresh.

Roughly 1,440 requests/hour at 30 repos. Reuses the `PerRepoCache` +
enrichment-worker pattern the backend already runs twice.

### 2. Fold into the main 20-second refresh

Freshest data, no new worker. Rejected: ~10,800 requests/hour at 30 repos,
over budget, and it couples a slow, failure-prone enrichment to the cycle that
renders the whole board.

Retained as an escape hatch — `Dashboard:ReviewSignalSeconds` is configuration,
so shortening the interval needs no code change, only rate-limit headroom.

### 3. Per-PR REST, no GraphQL

Keeps the backend on its existing typed `HttpClient`. Rejected: unresolved-thread
state is GraphQL-only (REST `pulls/{n}/comments` exposes no `isResolved`), so
this cannot express the chosen signal at all.

## Signal semantics

Per reviewer, per PR, evaluated in this order:

| State | Meaning | Derived from |
|---|---|---|
| `disabled` | Not required on this PR | Reviewer declares a `RequiredLabel` and the PR does not carry it |
| `outstanding` | Items still open | Bot: unresolved `reviewThreads` whose **first comment** author is `BotLogin`. CodeQL: open alerts on `refs/pull/<n>/head` |
| `clean` | Ran, nothing open | Zero outstanding **and** positive evidence it ran |
| `pending` | Required, no evidence | Everything else |

Evidence of a run means, for a bot reviewer, any review or any thread (resolved
or not) authored by `BotLogin`, or a check-run whose app slug matches; for
CodeQL, a completed code-scanning check-run in the status rollup.

The `pending` state is why this is four states and not the three originally
asked for. Without it, "zero unresolved threads" collapses two opposite
situations — reviewed and clear, versus nobody looked — into the same green
pill. Two recorded traps make that collapse a live risk rather than a
theoretical one: a rate-limited CodeRabbit check passes by design, and
`github-code-quality[bot]` review threads post later than the check reports
success.

Reading a check-run conclusion instead was considered and rejected for the same
reason: a green CodeQL check means the scan ran, not that zero alerts remain.

## Contract

Both repos gain one optional field on `PullRequest`. Optional is load-bearing:
`null` or absent covers an older backend, a bot-authored PR, and a deployment
with the feature off, and all three render identically — nothing.

```ts
// packages/ci-frontend/src/api/types.ts
export type ReviewSignalState = 'clean' | 'outstanding' | 'pending' | 'disabled'

export interface ReviewSignal {
  name: string                  // display label, e.g. "CodeRabbit"
  state: ReviewSignalState
  count?: number | null         // items outstanding; only when state === 'outstanding'
  htmlUrl?: string | null       // deep link to the threads / alert list
}

export interface PullRequest {
  // ...existing six fields unchanged
  reviewSignals?: ReviewSignal[] | null
}
```

```csharp
// src/FixPortal.Ci.Backend.Api/Dashboard/Model/DashboardModels.cs
public enum ReviewSignalState { Clean, Outstanding, Pending, Disabled }

public sealed record ReviewSignal(string Name, ReviewSignalState State, int? Count, string? HtmlUrl);

public sealed record PullRequest(
    int Number, string Title, string Author, string HtmlUrl,
    bool IsDraft, Instant CreatedAt,
    IReadOnlyList<ReviewSignal>? ReviewSignals = null);
```

## Configuration

Shipped **off**: `Reviewers` is empty in `appsettings.json`, so a self-hoster who
upgrades gets no new API calls and no UI change. FixPortal's three live in
deployment configuration.

```json
"ReviewSignals": {
  "ExcludedAuthors": [ "dependabot[bot]", "renovate[bot]" ],
  "Reviewers": [
    { "Name": "CodeRabbit", "BotLogin": "coderabbitai", "RequiredLabel": "review-high" },
    { "Name": "Gitar",      "BotLogin": "gitar-app" },
    { "Name": "CodeQL",     "Source": "CodeScanning" }
  ]
}
```

`Gitar`'s `BotLogin` above is unverified. Confirm it against a real PR's review
author before enabling — a wrong login matches nothing and renders permanent
`pending`, which looks like a working feature.

## Backend design

**Worker.** New `ReviewSignalEnrichmentWorker`, shaped like
`MergedPrEnrichmentWorker`: `PeriodicTimer` on `Dashboard:ReviewSignalSeconds`
(150s), writing to a `PerRepoCache<IReadOnlyDictionary<int, IReadOnlyList<ReviewSignal>>>`.
`DashboardRefreshService` merges by PR number when assembling
`RepositorySnapshot`; a PR absent from the cache gets `null`. The 20-second
cycle never waits on this worker and never fails because of it.

**Fetch, two calls per repo per cycle.** One GraphQL POST to `/graphql` — same
host, so it reuses the existing typed `HttpClient` and auth header — covering
every open PR in the repo:

```graphql
pullRequests(states: OPEN, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
  nodes {
    number
    author { login }
    labels(first: 20) { nodes { name } }
    reviews(first: 50) { nodes { author { login } } }
    reviewThreads(first: 100) {
      nodes { isResolved comments(first: 1) { nodes { author { login } } } }
    }
    commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 50) { nodes {
      ... on CheckRun { name conclusion checkSuite { app { slug } } }
    } } } } } }
  }
}
```

One REST GET to `code-scanning/alerts?state=open&per_page=100`, bucketed by
`most_recent_instance.ref` onto `refs/pull/<n>/head`.

GraphQL is a POST, so the existing ETag store gives it nothing — that cost is
real every cycle, unlike the REST paths.

**Dependabot exclusion** happens during mapping: PRs whose author is in
`ExcludedAuthors` are dropped before signals are built, so they carry `null`.
Under per-repo batching this saves no API calls — the repo's query returns every
open PR regardless. It buys the clean row, not throughput.

**Failure handling**, all degrading toward `pending` rather than toward a wrong
`clean`:

- GraphQL `errors` array or repo-level failure — retain last-known-good cache
  for that repo, log once, retry next tick. No partial write.
- Code-scanning 403/404 (Advanced Security off, or the token lacks the
  permission) — CodeQL renders `pending` everywhere, logged once at startup
  rather than per cycle.
- `GitHubRateLimitException` — swallowed, retried next tick, matching
  `JobLaneEnrichmentWorker.cs:53`.
- Auth failures pass `affectsAuthState: false`, so an optional feature can never
  flip `/api/health` red — the same call the PR fetch makes at
  `GitHubOrgClient.cs:197`.

**Operator prerequisite:** the fine-grained PAT gains *Code scanning alerts:
read*. Without it the CodeQL pill is permanently `pending`; the other two work.

## Frontend design

`flattenOpenPrs` spreads `...pr`, so `reviewSignals` reaches the stepper with no
change to that helper.

**`components/ReviewPills.tsx`** — presentational, importing only `api/types`
and `lib`, memoised like `SignalChip` so a no-change poll tick with preserved
object references skips the re-render. Returns `null` for absent or empty
signals.

**`lib/reviewSignalLabel.ts`** — the spoken form, modelled on `stateLabel.ts`
including its deliberate `Record<string, string>` keying, so an out-of-union
state from unvalidated snapshot JSON hits the fallback instead of being assumed
total.

```
outstanding -> "CodeRabbit: 3 outstanding"
clean       -> "CodeRabbit: clean"
pending     -> "CodeRabbit: not yet reviewed"
disabled    -> "CodeRabbit: not required"
```

**Styling** reuses the existing `.chip` system rather than a parallel one —
`.chip__dot`, `.chip__label`, `.chip__meta`, `--r-chip`, the `:focus-visible`
pattern and the `.chip--static` degradation. Four modifiers in `board.css`:

- `.chip--review-clean` — the `--ok-border` ramp, round dot.
- `.chip--review-outstanding` — `--bad-solid`, square 2px dot, the same
  non-colour shape cue as `.chip--failure` so it survives grayscale and
  red-green colour vision deficiency.
- `.chip--review-pending` — the muted, dashed, hollow-dot `unknown` treatment.
  Absence, not alarm.
- `.chip--review-disabled` — quieter still and lowest contrast, so it reads as
  "not applicable" from across the room rather than as a fourth status.

`count` renders visibly in `.chip__meta`. Colour is never the sole carrier: dot
shape plus an `.sr-only` label, per the WCAG 1.4.1 note at `board.css:120`.

**Links.** A pill with an `htmlUrl` links out through `isAllowedHref`, degrading
to a static span when the URL is rejected, following `SignalChip.tsx:20-23` so a
truthy-but-unsafe URL never becomes a dead `<a href="#">`. `pending` and
`disabled` pills never link.

**Placement.** `PullRequestStepper` only, between `.pr-card__title` and
`.pr-card__foot`. `PullRequestList` is untouched: three extra pills per PR
across 30 repos is too much for an always-on wall board, and the stepper is
where a single PR is actually read.

## Testing

**Frontend** (vitest, run from `packages/ci-frontend` — a root-level run fakes
architecture failures):

- `reviewSignalLabel.test.ts` — table-driven over the four states plus an
  out-of-union value, asserting the accessible name stays non-empty.
- `ReviewPills.test.tsx` — renders nothing for `null` / `undefined` / `[]`; one
  chip per signal; `count` only when outstanding; `.sr-only` text carries state
  in words; an `htmlUrl` rejected by `isAllowedHref` degrades to a `<span>`;
  `pending` and `disabled` never render an anchor.
- `PullRequestStepper.test.tsx` — pills present when signals exist, absent when
  `null`, and swapped correctly when paging between PRs.
- The ArchUnitTS spec needs no new rule; the existing forbidden-edge matrix
  already fails if `ReviewPills` reaches into hooks, pages or contexts.

**Backend** (xUnit v3, AwesomeAssertions, NSubstitute, following
`GitHubPullRequestTests.cs`):

- One `[Theory]` over the derivation matrix: missing required label →
  `Disabled`; unresolved thread whose first comment is the bot → `Outstanding`
  with count; thread by a human → not counted; resolved thread → not counted;
  zero outstanding with evidence → `Clean`; zero without evidence → `Pending`.
- Excluded author → `ReviewSignals` is `null`, rest of the PR unchanged.
- GraphQL `errors` payload → last-known-good retained, no partial write.
- Code-scanning 403/404 → CodeQL `Pending`, other reviewers unaffected.
- Alert ref bucketing → an alert on `refs/pull/181/head` reaches PR 181 only.
- Empty `Reviewers` config → zero HTTP calls, asserted against a recording
  handler. "Off by default" is only true if nothing fires.

## Rollout

Contract-first, so neither side outruns the other:

1. Backend ships with the feature off. The snapshot gains an optional field
   nothing populates.
2. Add *Code scanning alerts: read* to the PAT and switch `ReviewSignals` on in
   deployment configuration. Verify the live snapshot JSON carries the field
   before touching the frontend.
3. Frontend types, component and stepper wiring, released as a minor — the same
   release that publishes the `feat(filter)` work currently unreleased at 2.0.1.

Full local gate before either push: `npx tsc -b --noEmit`, `npx eslint .`,
`npx vitest run` from the package directory, and `npx vite build` because the
stepper is SSR-rendered.

## Open items

- Confirm Gitar's bot login against a real PR before enabling the reviewer.
- Confirm the fine-grained PAT needs nothing beyond Pull-requests-read for
  GraphQL `reviewThreads`.
- Confirm code-scanning alerts expose the PR head ref on
  `most_recent_instance.ref` as assumed by the bucketing step.

Each is a fetch-shape detail that surfaces in the first integration run; none
changes the design.
