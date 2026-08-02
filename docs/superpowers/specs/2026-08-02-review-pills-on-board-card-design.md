# Review pills on the board card

Supersedes the **Placement** decision in
`2026-07-31-pr-review-status-pills-design.md`, which put the pills in
`PullRequestStepper` only. Everything else in that spec — the four states, the
`.chip--review-*` treatments, the `ReviewSignal` contract, the backend
derivation — stands unchanged.

## Why the earlier decision is being reversed

The stepper-only call was made on density: "three extra pills per PR across 30
repos is too much for an always-on wall board". That reasoning assumed a
narrower PR row than the one that shipped. A repo card is **full width and
single-column** — `.dashboard-page` is `max-width: 1100px` with `--space-6`
inline padding, and `.repo-list` is a vertical flex column — so a PR row is
about 1050px carrying a number, a title and a meta line. The right-hand two
thirds are empty.

Placing the pills at the right edge of the existing row therefore costs **no
extra height at all** and consumes space that was already dead. The density
objection applied to pills on their own line; it does not apply to pills in the
row's unused right margin.

The board is also where the question is actually asked. "Which of my open PRs
is blocked on a reviewer?" is a scanning question across every repo; the
stepper answers it one PR at a time, behind a click.

## Scope

Frontend only, in `packages/ci-frontend`. No backend change, no contract
change, no new component.

**Not in scope:** switching the feature on in production. `ReviewSignals:Reviewers`
is `[]` in `fixportal-ci-backend`'s `appsettings.json`, and
`ReviewSignalEnrichmentWorker.cs:35` gates on `Reviewers.Count > 0`, so no
snapshot currently carries `reviewSignals` and the pills render nowhere. This
change means they appear on the board card the moment signals arrive.
Populating `Reviewers` in deployment configuration is separate work in that
repo, tracked as step 2 of the earlier spec's rollout.

## Placement

`ReviewPills` renders a second time, in `PullRequestList`, right-aligned on the
PR line. The stepper keeps its copy: it is the focused single-PR view with
arrow-key paging, and stripping the pills there would make the dialog less
informative than the row behind it.

```
#181  Add FIX decoder panel        [CodeRabbit 2] [Gitar] [Code scanning]
      chris · 2d ago
```

## Markup

The `<li>` gains one wrapper so the link and the pills are siblings on a shared
line, with the meta line below:

```tsx
<li className={pr.isDraft ? 'repo-prs__item repo-prs__item--draft' : 'repo-prs__item'}>
  <div className="repo-prs__line">
    {href !== '#' ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        <span className="repo-prs__num">#{pr.number}</span>
        <span className="repo-prs__title">{pr.title}</span>
      </a>
    ) : (
      <span className="repo-prs__static">…</span>
    )}
    <ReviewPills signals={pr.reviewSignals} />
  </div>
  <span className="repo-prs__meta">…</span>
</li>
```

The pills sit **outside** the PR anchor. Nesting them inside would put
interactive content within interactive content, and each pill carries its own
link to its reviewer's threads or alerts.

`ReviewPills` itself is not modified. It already returns `null` for `undefined`,
`null` and `[]`, filters malformed entries, routes out-of-union states to
`chip--review-unknown`, and is memoised — so a repo with no signals renders
exactly what it renders today.

## CSS

Two rules in `board.css`, in the `.repo-prs` block:

```css
.repo-prs__line {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}
.repo-prs__line .review-pills { margin: 0; }
```

`justify-content: space-between` carries the whole responsive behaviour with no
breakpoint and no JavaScript:

- Both items fit on one line → title left, pills hard right.
- Pills wrap to their own line → that line holds a single item, which
  `space-between` places at flex-start, so the cluster sits left-aligned
  beneath the title. This is the degradation chosen during design: the narrow
  layout becomes the on-its-own-line treatment, in exactly the situation where
  that treatment was the better fit.

Nothing is hidden and no title is truncated at any width.

The margin override is load-bearing. `.review-pills` ships with
`margin: var(--space-2) 0` for the stepper card, and left in place it would add
vertical height to every PR row — the exact cost this placement exists to
avoid. Scoping the override to `.repo-prs__line` leaves the stepper untouched.

`.review-pills` already sets `flex-wrap: wrap`, so a card narrow enough to break
the cluster itself wraps within it.

## Testing

Run from `packages/ci-frontend` — a root-level vitest run fakes architecture
failures.

`PullRequestList.test.tsx`:

- The existing test asserting pills are *absent* ("they are a stepper-only
  affordance") inverts: one pill per signal, rendered for the PR that carries
  them.
- Renders no `.review-pills` when `reviewSignals` is absent — the common case
  while the backend feature is off, and the guarantee that this change is inert
  until signals arrive.
- The pills are not descendants of the PR anchor.
- The existing link-rendering and sanitizer-rejection tests must still pass
  unchanged; the restructure must not move the anchor or the static-span
  fallback.

`board.css.test.ts` gains a presence check for `.repo-prs__line`, matching how
that suite already guards the other board rules.

No new ArchUnitTS rule: `PullRequestList` importing a sibling component is an
already-permitted edge.

## Release

Ships as a minor — `2.2.0` — then `@fix-portal/ci-frontend` is bumped in
`fixportal-simulator-frontend`, which currently resolves `2.1.0`.

Full local gate before the push: `npx tsc -b --noEmit`, `npx eslint .`,
`npx vitest run` from the package directory, and `npx vite build` — the PR list
is SSR-rendered, and jsdom masks SSR errors that the build surfaces.
