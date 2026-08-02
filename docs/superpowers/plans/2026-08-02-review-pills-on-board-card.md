# Review Pills on the Board Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the existing `ReviewPills` component right-aligned on each pull-request row of the repo board card, so review state is scannable across every repo without opening the stepper dialog.

**Architecture:** No new component and no contract change. `PullRequestList` gains one wrapper `<div>` so the PR link and `<ReviewPills>` are siblings on a shared flex line; two CSS rules in `board.css` handle alignment and responsive wrapping. `PullRequestStepper` is untouched and keeps its own copy of the pills.

**Tech Stack:** React 19, TypeScript, Vite, vitest + @testing-library/react, plain CSS (no framework).

**Spec:** `docs/superpowers/specs/2026-08-02-review-pills-on-board-card-design.md`

## Global Constraints

- Run vitest **from `packages/ci-frontend`**, never from the repo root — a root-level run fakes 13 architecture failures.
- Assertions use vitest + `@testing-library/react` (`expect(...).toBeInTheDocument()` etc.), matching every existing test in this package. This is the frontend package; the xUnit / AwesomeAssertions house rules do not apply here.
- No emoji anywhere — code, comments, commit messages, PR body.
- `ReviewPills.tsx` is **not modified** by this plan. It already returns `null` for `undefined` / `null` / `[]`, filters malformed entries, and routes out-of-union states to `chip--review-unknown`.
- `PullRequestStepper.tsx` is **not modified** by this plan.
- Every commit is made on branch `feat/review-pills-board-card`, which already exists and already carries the spec commit.
- The full local gate (Task 4) must pass before any push. No exceptions.

---

### Task 1: Render the pills in the PR list

**Files:**
- Modify: `packages/ci-frontend/src/components/PullRequestList.tsx` (whole component body, currently lines 5-37)
- Test: `packages/ci-frontend/src/components/PullRequestList.test.tsx:30-35` (existing test inverts) plus three new tests

**Interfaces:**
- Consumes: `ReviewPills({ signals }: { signals?: ReviewSignal[] | null })` from `./ReviewPills`; `PullRequest.reviewSignals?: ReviewSignal[] | null` from `../api/types`.
- Produces: a `.repo-prs__line` wrapper element in the rendered markup, which Task 2's CSS selects on. No exported API changes — `PullRequestList({ pullRequests }: { pullRequests: PullRequest[] })` keeps its signature.

- [ ] **Step 1: Replace the stepper-only test with the new expectations**

In `packages/ci-frontend/src/components/PullRequestList.test.tsx`, delete this existing test entirely:

```tsx
test('does not render review pills -- they are a stepper-only affordance', () => {
  const reviewSignals: ReviewSignal[] = [{ name: 'CodeRabbit', state: 'outstanding', count: 2 }]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  expect(container.querySelector('.review-pills')).toBeNull()
})
```

and append these four in its place:

```tsx
test('renders one review pill per signal on the PR row', () => {
  const reviewSignals: ReviewSignal[] = [
    { name: 'CodeRabbit', state: 'outstanding', count: 2 },
    { name: 'Gitar', state: 'clean' },
  ]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  expect(container.querySelectorAll('.review-pills .chip')).toHaveLength(2)
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
  expect(screen.getByText('Gitar')).toBeInTheDocument()
})

// The backend ships the feature off (ReviewSignals:Reviewers is empty), so the
// no-signals path is the live one until that config lands. It must render byte
// for byte what it rendered before this change.
test('renders no pills when the PR carries no review signals', () => {
  const { container } = render(<PullRequestList pullRequests={prs} />)
  expect(container.querySelector('.review-pills')).toBeNull()
})

// Pills carry their own links to a reviewer's threads or alerts. Nested inside
// the PR anchor they would be interactive content within interactive content --
// invalid HTML, and a click that resolves to whichever the browser prefers.
test('renders the pills outside the PR anchor, not nested within it', () => {
  const reviewSignals: ReviewSignal[] = [{ name: 'CodeRabbit', state: 'clean' }]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  const pills = container.querySelector('.review-pills')
  expect(pills).not.toBeNull()
  expect(pills?.closest('a')).toBeNull()
})

// The wrapper is not cosmetic: board.css hangs the right-alignment and the
// responsive wrap off .repo-prs__line, so losing it silently un-styles the row.
test('wraps the PR link and its pills in a shared line element', () => {
  const reviewSignals: ReviewSignal[] = [{ name: 'CodeRabbit', state: 'clean' }]
  const withSignals: PullRequest[] = [{ ...prs[0], reviewSignals }]
  const { container } = render(<PullRequestList pullRequests={withSignals} />)
  const line = container.querySelector('.repo-prs__line')
  expect(line?.querySelector('a')).not.toBeNull()
  expect(line?.querySelector('.review-pills')).not.toBeNull()
})
```

The file's existing imports already cover everything used here (`render`, `screen`, `expect`, `test`, `PullRequestList`, `PullRequest`, `ReviewSignal`) — do not add any.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/ci-frontend`:

```
npx vitest run src/components/PullRequestList.test.tsx
```

Expected: FAIL. Three of the four new tests fail — no `.review-pills` and no `.repo-prs__line` are rendered. "renders no pills when the PR carries no review signals" passes already; that is correct, it is a regression guard.

- [ ] **Step 3: Restructure the component and render the pills**

Replace the whole of `packages/ci-frontend/src/components/PullRequestList.tsx` with:

```tsx
import type { PullRequest } from '../api/types'
import { formatRelativeTime } from '../lib/relativeTime'
import { isAllowedHref } from '../lib/isAllowedHref'
import { ReviewPills } from './ReviewPills'

export function PullRequestList({ pullRequests }: { pullRequests: PullRequest[] }) {
  if (pullRequests.length === 0) return null
  return (
    <div className="repo-prs">
      <span className="repo-prs__count">
        {pullRequests.length} open PR{pullRequests.length === 1 ? '' : 's'}
      </span>
      <ul>
        {pullRequests.map(pr => {
          const href = isAllowedHref(pr.htmlUrl)
          return (
            <li key={pr.number} className={pr.isDraft ? 'repo-prs__item repo-prs__item--draft' : 'repo-prs__item'}>
              {/* The link and the pills share one flex line so the pills can take the
                  row's unused right-hand space -- see .repo-prs__line in board.css.
                  The pills stay OUTSIDE the anchor: each one carries its own link, and
                  an anchor inside an anchor is invalid. */}
              <div className="repo-prs__line">
                {href !== '#' ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <span className="repo-prs__num">#{pr.number}</span>
                    <span className="repo-prs__title">{pr.title}</span>
                  </a>
                ) : (
                  <span className="repo-prs__static">
                    <span className="repo-prs__num">#{pr.number}</span>
                    <span className="repo-prs__title">{pr.title}</span>
                  </span>
                )}
                <ReviewPills signals={pr.reviewSignals} />
              </div>
              <span className="repo-prs__meta">
                {pr.author} · {formatRelativeTime(pr.createdAt)}{pr.isDraft ? ' · draft' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

The only changes from the current file are the added `ReviewPills` import, the `.repo-prs__line` wrapper around the link/static-span branch, and the `<ReviewPills>` call inside that wrapper. The anchor, the static-span fallback, the draft class and the meta line are byte-identical to before.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `packages/ci-frontend`:

```
npx vitest run src/components/PullRequestList.test.tsx
```

Expected: PASS, 7 tests. The three pre-existing tests (GitHub link rendering, empty list, sanitizer rejection) must still pass — they assert the anchor and static-span behaviour the restructure moved but did not change.

- [ ] **Step 5: Run the sibling suites for regressions**

Run from `packages/ci-frontend`:

```
npx vitest run src/components/RepoBoard.test.tsx src/components/PullRequestStepper.pills.test.tsx src/components/ReviewPills.test.tsx
```

Expected: PASS. `RepoBoard` renders `PullRequestList`, and the two pill suites prove the stepper's copy and the component itself are untouched.

- [ ] **Step 6: Commit**

```bash
git add packages/ci-frontend/src/components/PullRequestList.tsx packages/ci-frontend/src/components/PullRequestList.test.tsx
git commit -m "feat(board): show review pills on the PR row"
```

---

### Task 2: Align the pills to the right of the row

**Files:**
- Modify: `packages/ci-frontend/src/styles/board.css` (insert after `.repo-prs ul`, currently ending line 913)
- Test: `packages/ci-frontend/src/styles/board.css.test.ts:28-32`

**Interfaces:**
- Consumes: the `.repo-prs__line` class rendered by Task 1, and the `.review-pills` class rendered by the unmodified `ReviewPills`.
- Produces: no code interface — CSS only.

- [ ] **Step 1: Write the failing stylesheet test**

In `packages/ci-frontend/src/styles/board.css.test.ts`, append a second `describe` block after the existing one:

```ts
// Same reasoning as the pill-state block above: a render test only asserts the
// class is on the element, never that board.css defines it. Deleting these two
// rules would leave every component test green while the pills lost their
// right alignment and silently re-grew the vertical margin they exist to avoid.
describe('board.css PR-row layout', () => {
  it('defines .repo-prs__line', () => {
    expect(css).toContain('.repo-prs__line')
  })

  it('zeroes the review-pills margin inside a PR row', () => {
    expect(css).toContain('.repo-prs__line .review-pills')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `packages/ci-frontend`:

```
npx vitest run src/styles/board.css.test.ts
```

Expected: FAIL, both new cases, with the received value being the whole stylesheet text.

- [ ] **Step 3: Add the two rules**

In `packages/ci-frontend/src/styles/board.css`, immediately after the `.repo-prs ul { ... }` rule and before `.repo-prs__item a`, insert:

```css
  /* The PR link and its review pills share one line. `space-between` is doing
     all the responsive work here, with no breakpoint and no JS:
       - both fit on one line -> title left, pills hard right, in the ~1050px
         row's otherwise dead right-hand space, costing zero extra height;
       - pills wrap onto their own line -> that line holds a single item, which
         `space-between` places at flex-start, so the cluster sits left-aligned
         under the title rather than stranded at the right edge.
     `margin-left: auto` on the pills would give the first behaviour and get the
     second wrong. Nothing is hidden and no title is truncated at any width. */
  .repo-prs__line {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  /* .review-pills ships with `margin: var(--space-2) 0` for the stepper's card,
     where the pills own a line. In a board row that margin would add height to
     every PR -- the exact cost this placement exists to avoid -- so it is zeroed
     here only. The stepper's copy keeps it. */
  .repo-prs__line .review-pills {
    margin: 0;
  }
```

Note the two-space indent: every rule in this file sits inside a wrapping block, so match the surrounding indentation exactly.

- [ ] **Step 4: Run the test to verify it passes**

Run from `packages/ci-frontend`:

```
npx vitest run src/styles/board.css.test.ts
```

Expected: PASS, 7 tests (5 pill states + 2 new layout cases).

- [ ] **Step 5: Commit**

```bash
git add packages/ci-frontend/src/styles/board.css packages/ci-frontend/src/styles/board.css.test.ts
git commit -m "style(board): right-align review pills on the PR row"
```

---

### Task 3: Release as 2.2.0

**Files:**
- Modify: `packages/ci-frontend/package.json:3` (`"version": "2.1.0"`)
- Modify: `package-lock.json` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: the version `fixportal-simulator-frontend` will bump its `@fix-portal/ci-frontend` dependency to after this merges and publishes.

- [ ] **Step 1: Bump the package version**

In `packages/ci-frontend/package.json`, change line 3 from `"version": "2.1.0",` to `"version": "2.2.0",`. Minor, not patch: this adds a visible rendering surface to an existing component without breaking any consumer — a repo whose snapshot carries no `reviewSignals` renders exactly as it did at 2.1.0.

- [ ] **Step 2: Sync the lockfile**

Run from the repo root:

```
npm install --package-lock-only
```

Expected: `package-lock.json` picks up `2.2.0` for the workspace package. Do not edit it by hand — a hand-edited lockfile drifting from `package.json` is what commit 1372160 had to repair.

- [ ] **Step 3: Confirm nothing else moved**

Run from the repo root:

```
git diff --stat
```

Expected: exactly two files changed, `packages/ci-frontend/package.json` and `package-lock.json`. If `npm install --package-lock-only` rewrote unrelated dependency entries, discard and investigate before continuing — an unintended transitive bump does not belong in this branch.

- [ ] **Step 4: Commit**

```bash
git add packages/ci-frontend/package.json package-lock.json
git commit -m "release: bump @fix-portal/ci-frontend to 2.2.0"
```

---

### Task 4: Full local gate

**Files:** none modified. This task is the pre-push gate and produces no commit unless a check fails.

**Interfaces:**
- Consumes: the working tree as left by Tasks 1-3.
- Produces: a branch safe to push.

- [ ] **Step 1: Typecheck**

Run from the repo root:

```
npx tsc -b --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 2: Lint**

Run from the repo root:

```
npx eslint .
```

Expected: exit 0. CI runs eslint as its own blocking step and fails on errors, and neither `tsc` nor `vitest` nor `vite build` runs it — a clean type-and-test pass can still red CI here.

- [ ] **Step 3: Full test suite**

Run **from `packages/ci-frontend`**:

```
npx vitest run
```

Expected: PASS, whole suite. A root-level run fakes 13 architecture failures — if you see those, you are in the wrong directory.

- [ ] **Step 4: Library build**

Run from the repo root:

```
npm run build:lib
```

Expected: exit 0.

- [ ] **Step 5: App build**

Run from the repo root:

```
npm run build:app
```

Expected: exit 0. The PR list is SSR-rendered and jsdom masks SSR errors that only the build surfaces, so this step is not optional. There is no root-level `build` script — these two are the builds.

- [ ] **Step 6: Visual check against a live board**

Run from the repo root:

```
npm run dev
```

Open the dashboard. Because `ReviewSignals:Reviewers` is empty in `fixportal-ci-backend`, no live PR carries `reviewSignals`, so the correct observation is that **the PR rows look exactly as they did before** — same height, same alignment, no gaps. That is the inert-until-configured guarantee, verified by eye rather than only asserted in a test. Stop the dev server when done.

---

## What this plan does not do

- **It does not make the pills visible in production.** `ReviewSignals:Reviewers` is `[]` in `fixportal-ci-backend`'s `appsettings.json` and `ReviewSignalEnrichmentWorker.cs:35` gates on `Reviewers.Count > 0`, so no snapshot carries `reviewSignals` yet. Populating that config, and adding *Code scanning alerts: read* to the PAT, is separate work in that repo.
- **It does not bump `fixportal-simulator-frontend`.** That repo resolves `@fix-portal/ci-frontend@^2.1.0`; its bump happens after this branch merges and 2.2.0 is published.
- **It does not touch `PullRequestStepper`, `ReviewPills`, or the `ReviewSignal` contract.**

## Spec coverage

| Spec requirement | Task |
|---|---|
| Pills right-aligned on the PR row in `PullRequestList` | 1 |
| Pills outside the PR anchor | 1 |
| Stepper keeps its copy | not modified, asserted in 1 step 5 |
| `.repo-prs__line` flex rule with `space-between` wrapping | 2 |
| `.review-pills` margin zeroed inside the row only | 2 |
| Existing "stepper-only" test inverted | 1 |
| No pills when `reviewSignals` absent | 1 |
| `board.css.test.ts` presence check | 2 |
| Ships as 2.2.0 | 3 |
| Full local gate incl. `vite build` | 4 |
| No README change needed | n/a by design |
