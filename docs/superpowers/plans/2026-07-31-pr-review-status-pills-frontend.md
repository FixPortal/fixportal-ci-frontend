# PR Review Status Pills (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render per-reviewer status pills (CodeRabbit, Gitar, CodeQL) inside the pull-request stepper, driven entirely by an optional snapshot field.

**Architecture:** One pure label helper in `lib/`, one presentational memoised component in `components/`, four CSS modifiers on the existing `.chip` system, and a single render site in `PullRequestStepper`. The frontend knows no reviewer names and no label conventions — it renders whatever `reviewSignals` the snapshot carries, and nothing when the field is absent.

**Tech Stack:** React 19, TypeScript, Vite, Vitest 4.1.9 (pinned), @testing-library/react, ArchUnitTS.

**Spec:** `docs/superpowers/specs/2026-07-31-pr-review-status-pills-design.md`

**Companion plan:** the backend half lives in `fixportal-ci-backend` at `docs/superpowers/plans/2026-07-31-pr-review-status-pills-backend.md`. This plan is independently testable — every test here supplies its own fixture data — but the pills stay invisible in production until the backend ships and is switched on.

## Global Constraints

- Run every check from `packages/ci-frontend`, never the repo root. A root-level vitest run fakes 13 architecture failures.
- `vitest` and `@vitest/coverage-v8` are pinned to exactly `4.1.9`. Do not upgrade them; 4.1.10 breaks `.rejects.toThrow(<message>)`.
- Tests import `{ expect, test }` from `vitest` explicitly. This project runs with `globals: false`.
- Components in `components/` may import from `api/` and `lib/` only — never hooks, pages, or `*Context.tsx`. The ArchUnitTS spec enforces this and will fail the build.
- No emoji anywhere: source, comments, commit messages.
- Colour is never the sole carrier of state. Every pill carries an `.sr-only` text label (WCAG 2.2 SC 1.4.1).
- `reviewSignals` is optional on the wire. Absent, `null`, and `[]` must all render nothing.
- Commit after each task. Do not push until the whole plan is green (CodeRabbit spends its budget per push).

---

### Task 1: Contract types and the label helper

**Files:**
- Modify: `packages/ci-frontend/src/api/types.ts:23-30`
- Modify: `packages/ci-frontend/src/index.ts:6-19`
- Create: `packages/ci-frontend/src/lib/reviewSignalLabel.ts`
- Test: `packages/ci-frontend/src/lib/reviewSignalLabel.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ReviewSignalState` (`'clean' | 'outstanding' | 'pending' | 'disabled'`), `ReviewSignal` (`{ name: string; state: ReviewSignalState; count?: number | null; htmlUrl?: string | null }`), `PullRequest.reviewSignals?: ReviewSignal[] | null`, and `reviewSignalLabel(signal: ReviewSignal): string`.

- [ ] **Step 1: Add the types**

In `packages/ci-frontend/src/api/types.ts`, above the existing `PullRequest` interface:

```ts
export type ReviewSignalState = 'clean' | 'outstanding' | 'pending' | 'disabled'

export interface ReviewSignal {
  name: string
  state: ReviewSignalState
  count?: number | null
  htmlUrl?: string | null
}
```

Then add one field to the existing `PullRequest` interface, leaving its six current fields untouched:

```ts
export interface PullRequest {
  number: number
  title: string
  author: string
  htmlUrl: string
  isDraft: boolean
  createdAt: string
  // Optional so a new frontend renders against an older backend, and so a bot PR
  // (excluded from review enrichment) and a deployment with the feature off both
  // arrive as "nothing to show" rather than as an empty-but-present row.
  reviewSignals?: ReviewSignal[] | null
}
```

Export both new types from the barrel by adding `ReviewSignalState,` and `ReviewSignal,` to the existing `export type { ... } from './api/types'` block in `packages/ci-frontend/src/index.ts`.

- [ ] **Step 2: Write the failing test**

Create `packages/ci-frontend/src/lib/reviewSignalLabel.test.ts`:

```ts
import { expect, test } from 'vitest'
import { reviewSignalLabel } from './reviewSignalLabel'
import type { ReviewSignal } from '../api/types'

const signal = (over: Partial<ReviewSignal>): ReviewSignal => ({ name: 'CodeRabbit', state: 'clean', ...over })

test.each([
  [signal({ state: 'clean' }), 'CodeRabbit: clean'],
  [signal({ state: 'pending' }), 'CodeRabbit: not yet reviewed'],
  [signal({ state: 'disabled' }), 'CodeRabbit: not required'],
  [signal({ state: 'outstanding', count: 3 }), 'CodeRabbit: 3 outstanding'],
  [signal({ state: 'outstanding', count: 1 }), 'CodeRabbit: 1 outstanding'],
])('describes %o as %s', (input, expected) => {
  expect(reviewSignalLabel(input)).toBe(expected)
})

test('falls back to a non-empty name when the count is missing on an outstanding signal', () => {
  expect(reviewSignalLabel(signal({ state: 'outstanding' }))).toBe('CodeRabbit: outstanding')
})

test('falls back rather than rendering an empty accessible name for an out-of-union state', () => {
  const rogue = signal({ state: 'exploded' as ReviewSignal['state'] })
  expect(reviewSignalLabel(rogue)).toBe('CodeRabbit: status unknown')
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run from `packages/ci-frontend`: `npx vitest run src/lib/reviewSignalLabel.test.ts`
Expected: FAIL — cannot resolve `./reviewSignalLabel`.

- [ ] **Step 4: Write the implementation**

Create `packages/ci-frontend/src/lib/reviewSignalLabel.ts`:

```ts
import type { ReviewSignal } from '../api/types'

// The spoken form of a reviewer's state, rendered into each pill's accessible
// name (an .sr-only span) so the signal is never colour-only. Mirrors
// stateLabel.ts, including its deliberate Record<string, string> keying: the
// snapshot boundary does no runtime validation, so an out-of-union value from a
// newer backend must index to undefined and hit the fallback rather than have TS
// assume the lookup is total and elide the guard.
const STATE_LABELS: Record<string, string> = {
  clean: 'clean',
  outstanding: 'outstanding',
  pending: 'not yet reviewed',
  disabled: 'not required',
}

export function reviewSignalLabel(signal: ReviewSignal): string {
  if (signal.state === 'outstanding' && typeof signal.count === 'number') {
    return `${signal.name}: ${signal.count} outstanding`
  }
  return `${signal.name}: ${STATE_LABELS[signal.state] ?? 'status unknown'}`
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run from `packages/ci-frontend`: `npx vitest run src/lib/reviewSignalLabel.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Typecheck**

Run from `packages/ci-frontend`: `npx tsc -b --noEmit`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/ci-frontend/src/api/types.ts packages/ci-frontend/src/index.ts packages/ci-frontend/src/lib/reviewSignalLabel.ts packages/ci-frontend/src/lib/reviewSignalLabel.test.ts
git commit -m "feat(types): add review signal contract and label helper"
```

---

### Task 2: The ReviewPills component

**Files:**
- Create: `packages/ci-frontend/src/components/ReviewPills.tsx`
- Test: `packages/ci-frontend/src/components/ReviewPills.test.tsx`

**Interfaces:**
- Consumes: `ReviewSignal` from `api/types`, `reviewSignalLabel` from `lib/reviewSignalLabel`, `isAllowedHref` from `lib/isAllowedHref`.
- Produces: `ReviewPills({ signals }: { signals?: ReviewSignal[] | null })`.

- [ ] **Step 1: Write the failing test**

Create `packages/ci-frontend/src/components/ReviewPills.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ReviewPills } from './ReviewPills'
import type { ReviewSignal } from '../api/types'

const signals: ReviewSignal[] = [
  { name: 'CodeRabbit', state: 'outstanding', count: 3, htmlUrl: 'https://github.com/x/y/pull/7/files' },
  { name: 'Gitar', state: 'clean' },
  { name: 'CodeQL', state: 'pending' },
]

test('renders one pill per signal', () => {
  render(<ReviewPills signals={signals} />)
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
  expect(screen.getByText('Gitar')).toBeInTheDocument()
  expect(screen.getByText('CodeQL')).toBeInTheDocument()
})

test.each([[undefined], [null], [[] as ReviewSignal[]]])('renders nothing for %o', input => {
  const { container } = render(<ReviewPills signals={input} />)
  expect(container.firstChild).toBeNull()
})

test('shows the count only on an outstanding signal', () => {
  render(<ReviewPills signals={signals} />)
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.queryByText('0')).toBeNull()
})

test('carries the state in words for screen readers, not colour alone', () => {
  render(<ReviewPills signals={signals} />)
  expect(screen.getByText('CodeRabbit: 3 outstanding')).toBeInTheDocument()
  expect(screen.getByText('Gitar: clean')).toBeInTheDocument()
  expect(screen.getByText('CodeQL: not yet reviewed')).toBeInTheDocument()
})

test('links an outstanding pill that has a safe url', () => {
  render(<ReviewPills signals={signals} />)
  const link = screen.getByRole('link', { name: /CodeRabbit/ })
  expect(link).toHaveAttribute('href', 'https://github.com/x/y/pull/7/files')
})

test('degrades to a static span when the url is rejected by the sanitizer', () => {
  render(<ReviewPills signals={[{ name: 'CodeRabbit', state: 'outstanding', count: 1, htmlUrl: 'javascript:alert(1)' }]} />)
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
})

test('never links a pending or disabled pill even when a url is supplied', () => {
  render(
    <ReviewPills
      signals={[
        { name: 'Gitar', state: 'pending', htmlUrl: 'https://github.com/x/y/pull/7' },
        { name: 'CodeRabbit', state: 'disabled', htmlUrl: 'https://github.com/x/y/pull/7' },
      ]}
    />,
  )
  expect(screen.queryByRole('link')).toBeNull()
})

test('applies a state-specific class so the four states are visually distinct', () => {
  const { container } = render(<ReviewPills signals={signals} />)
  expect(container.querySelector('.chip--review-outstanding')).not.toBeNull()
  expect(container.querySelector('.chip--review-clean')).not.toBeNull()
  expect(container.querySelector('.chip--review-pending')).not.toBeNull()
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run from `packages/ci-frontend`: `npx vitest run src/components/ReviewPills.test.tsx`
Expected: FAIL — cannot resolve `./ReviewPills`.

- [ ] **Step 3: Write the implementation**

Create `packages/ci-frontend/src/components/ReviewPills.tsx`:

```tsx
import { memo } from 'react'
import type { ReviewSignal } from '../api/types'
import { isAllowedHref } from '../lib/isAllowedHref'
import { reviewSignalLabel } from '../lib/reviewSignalLabel'

// Only a settled state earns a link. A pending pill has nothing to point at yet,
// and a disabled one is not applicable here — linking either would invite a click
// that lands on an empty page.
const LINKABLE: ReadonlySet<string> = new Set(['clean', 'outstanding'])

// Memoised for the same reason as SignalChip: on a no-change poll tick React Query
// preserves the signal array's reference (structural sharing), so the row skips
// re-rendering every 20 seconds.
export const ReviewPills = memo(function ReviewPills({ signals }: { signals?: ReviewSignal[] | null }) {
  if (!signals || signals.length === 0) return null
  return (
    <div className="review-pills">
      {signals.map(signal => {
        const label = reviewSignalLabel(signal)
        // Derive linkability from the sanitized href, never from raw truthiness: a
        // URL that is truthy but rejected by isAllowedHref must degrade to a static
        // span, not become a dead <a href="#"> (same rule as SignalChip).
        const href = LINKABLE.has(signal.state) ? isAllowedHref(signal.htmlUrl ?? undefined) : '#'
        const linkable = href !== '#'
        const className = `chip chip--review-${signal.state}${linkable ? '' : ' chip--static'}`
        const body = (
          <>
            <span className="chip__dot" aria-hidden="true" />
            <span className="chip__label">{signal.name}</span>
            {/* State in words for SR / colour-blind users — the dot is colour+shape only. */}
            <span className="sr-only">{label}</span>
            {signal.state === 'outstanding' && typeof signal.count === 'number' ? (
              <span className="chip__meta">{signal.count}</span>
            ) : null}
          </>
        )
        return linkable ? (
          <a
            key={signal.name}
            className={className}
            href={href}
            title={label}
            target="_blank"
            rel="noopener noreferrer"
          >
            {body}
          </a>
        ) : (
          <span key={signal.name} className={className} title={label}>
            {body}
          </span>
        )
      })}
    </div>
  )
})
```

- [ ] **Step 4: Run the test and verify it passes**

Run from `packages/ci-frontend`: `npx vitest run src/components/ReviewPills.test.tsx`
Expected: PASS, 12 tests.

- [ ] **Step 5: Verify the architecture rules still hold**

Run from `packages/ci-frontend`: `npx vitest run src/architecture.spec.ts`
Expected: PASS. This confirms `ReviewPills` imports only `api/` and `lib/`.

- [ ] **Step 6: Commit**

```bash
git add packages/ci-frontend/src/components/ReviewPills.tsx packages/ci-frontend/src/components/ReviewPills.test.tsx
git commit -m "feat(components): add ReviewPills"
```

---

### Task 3: Styling the four states

**Files:**
- Modify: `packages/ci-frontend/src/styles/board.css` (insert after the `.chip--running` reduced-motion block, around line 756)

**Interfaces:**
- Consumes: `.chip`, `.chip__dot`, `.chip__label`, `.chip__meta`, `.chip--static` and the `--ok-border` / `--bad-solid` / `--unknown` / `--surface-2` custom properties already defined in this file.
- Produces: `.review-pills`, `.chip--review-clean`, `.chip--review-outstanding`, `.chip--review-pending`, `.chip--review-disabled`.

- [ ] **Step 1: Add the styles**

Insert into `packages/ci-frontend/src/styles/board.css`, immediately after the existing `@media (prefers-reduced-motion: reduce) { .chip--running .chip__dot { animation: none; } }` block, keeping the file's existing two-space indentation inside its wrapping scope:

```css
  /* ---- Review pills -------------------------------------------------------- */

  /* One row of per-reviewer states on a pull request. Reuses the .chip system
     wholesale — only the state modifiers below are new. */
  .review-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: var(--space-2) 0;
  }

  /* Verified clean: the reviewer demonstrably ran and left nothing open. Mirrors
     .chip--success so "green" means the same thing everywhere on the board. */
  .chip--review-clean {
    background: color-mix(in srgb, var(--ok-border) 7%, var(--surface-2));
  }
  .chip--review-clean .chip__dot {
    background: var(--ok-border);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok-border) 30%, transparent);
  }

  /* Outstanding items. Square LED, as .chip--failure: the one state that must
     survive grayscale and red-green CVD without relying on the red. */
  .chip--review-outstanding {
    background: color-mix(in srgb, var(--bad-solid) 9%, var(--surface-2));
    border-color: color-mix(in srgb, var(--bad-solid) 32%, var(--border));
  }
  .chip--review-outstanding .chip__dot {
    background: var(--bad-solid);
    border-radius: 2px;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--bad-solid) 30%, transparent);
  }

  /* Required, but no evidence it has run — a paused reviewer, or a PR opened
     moments ago. Reads as absence, never as alarm: the .chip--unknown treatment. */
  .chip--review-pending {
    background: transparent;
    border-style: dashed;
    opacity: 0.72;
  }
  .chip--review-pending .chip__dot {
    width: 8px;
    height: 8px;
    background: transparent;
    border: 1.5px solid var(--unknown);
  }
  .chip--review-pending .chip__label {
    color: var(--text-muted);
    font-weight: 500;
  }

  /* Not required on this PR. Quieter than pending and lower contrast, so it reads
     as "not applicable" from across the room rather than as a fourth status. */
  .chip--review-disabled {
    background: transparent;
    border-style: dashed;
    opacity: 0.45;
  }
  .chip--review-disabled .chip__dot {
    width: 8px;
    height: 8px;
    background: transparent;
    border: 1.5px solid var(--border-strong);
  }
  .chip--review-disabled .chip__label {
    color: var(--text-muted);
    font-weight: 500;
  }
```

- [ ] **Step 2: Confirm the custom properties resolve**

Run: `npx eslint .` from `packages/ci-frontend`, then grep the file to confirm every property used above is defined in this stylesheet or in `tokens.css`:

```bash
grep -nE -- "--unknown:|--surface-2:|--space-2:" packages/ci-frontend/src/styles/board.css
```

Expected: each returns at least one definition line. If `--unknown` or `--surface-2` is not defined in `board.css`, use the value the neighbouring `.chip--unknown` rule uses rather than inventing a new property.

- [ ] **Step 3: Commit**

```bash
git add packages/ci-frontend/src/styles/board.css
git commit -m "style(board): add review pill state modifiers"
```

---

### Task 4: Render the pills in the stepper

**Files:**
- Modify: `packages/ci-frontend/src/components/PullRequestStepper.tsx:81` (between `.pr-card__title` and `.pr-card__foot`)
- Test: `packages/ci-frontend/src/components/PullRequestStepper.pills.test.tsx`

**Interfaces:**
- Consumes: `ReviewPills` from Task 2, `OpenPr` from `lib/flattenOpenPrs` (already `PullRequest & { repo: string }`, so `reviewSignals` flows through its existing spread with no change to that helper).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `packages/ci-frontend/src/components/PullRequestStepper.pills.test.tsx`. Note the `HTMLDialogElement.showModal` stub — jsdom does not implement it, and the existing stepper tests do the same:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, expect, test, vi } from 'vitest'
import { PullRequestStepper } from './PullRequestStepper'
import type { OpenPr } from '../lib/flattenOpenPrs'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

const base: OpenPr = {
  repo: 'fixportal-engine',
  number: 181,
  title: 'Add FIX decoder panel',
  author: 'chris',
  htmlUrl: 'https://github.com/x/y/pull/181',
  isDraft: false,
  createdAt: '2026-07-29T00:00:00Z',
}

test('renders the review pills for a PR that carries signals', () => {
  const pr: OpenPr = {
    ...base,
    reviewSignals: [
      { name: 'CodeRabbit', state: 'outstanding', count: 3 },
      { name: 'Gitar', state: 'clean' },
    ],
  }
  render(<PullRequestStepper prs={[pr]} onClose={() => {}} />)
  expect(screen.getByText('CodeRabbit')).toBeInTheDocument()
  expect(screen.getByText('CodeRabbit: 3 outstanding')).toBeInTheDocument()
  expect(screen.getByText('Gitar: clean')).toBeInTheDocument()
})

test('renders no pill row for a PR with no signals', () => {
  const { container } = render(<PullRequestStepper prs={[base]} onClose={() => {}} />)
  expect(container.querySelector('.review-pills')).toBeNull()
})

test('swaps the pills when paging to the next PR', () => {
  const first: OpenPr = { ...base, reviewSignals: [{ name: 'CodeRabbit', state: 'clean' }] }
  const second: OpenPr = { ...base, number: 182, createdAt: '2026-07-30T00:00:00Z', reviewSignals: [{ name: 'Gitar', state: 'pending' }] }
  render(<PullRequestStepper prs={[first, second]} onClose={() => {}} />)
  expect(screen.getByText('CodeRabbit: clean')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Next/ }))
  expect(screen.queryByText('CodeRabbit: clean')).toBeNull()
  expect(screen.getByText('Gitar: not yet reviewed')).toBeInTheDocument()
})
```

`fireEvent` comes from `@testing-library/react` — add it to that file's import. Do not add `@testing-library/user-event` as a dependency for one click.

- [ ] **Step 2: Run the test and verify it fails**

Run from `packages/ci-frontend`: `npx vitest run src/components/PullRequestStepper.pills.test.tsx`
Expected: FAIL — the pill text is not found.

- [ ] **Step 3: Wire the component in**

In `packages/ci-frontend/src/components/PullRequestStepper.tsx`, add the import beside the existing ones:

```tsx
import { ReviewPills } from './ReviewPills'
```

Then insert the render between the title and the footer, so the block reads:

```tsx
        <div className="pr-card__title">{pr.title}</div>
        <ReviewPills signals={pr.reviewSignals} />
        <div className="pr-card__foot">
```

- [ ] **Step 4: Run the test and verify it passes**

Run from `packages/ci-frontend`: `npx vitest run src/components/PullRequestStepper.pills.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the existing stepper tests to confirm no regression**

Run from `packages/ci-frontend`: `npx vitest run src/components/PullRequestStepper.gating.test.tsx src/components/PullRequestStepper.clamp.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ci-frontend/src/components/PullRequestStepper.tsx packages/ci-frontend/src/components/PullRequestStepper.pills.test.tsx
git commit -m "feat(stepper): show review pills on the PR card"
```

---

### Task 5: Full local gate and release prep

**Files:**
- Modify: `packages/ci-frontend/package.json` (version field)
- Modify: `README.md` (the feature list under the intro blockquote)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: a branch ready for one push.

- [ ] **Step 1: Typecheck**

Run from `packages/ci-frontend`: `npx tsc -b --noEmit`
Expected: exit 0, no output.

- [ ] **Step 2: Lint**

Run from the repo root: `npm run lint`
Expected: exit 0. Warnings do not fail CI; errors do. Two rules bite this kind of change specifically — `react-hooks/set-state-in-effect` and `@typescript-eslint/no-unused-expressions` (a `cond ? a() : b()` ternary used as a statement). If either fires, fix it rather than disabling it.

- [ ] **Step 3: Full test suite**

Run from `packages/ci-frontend`: `npx vitest run`
Expected: PASS, including `src/architecture.spec.ts`.

- [ ] **Step 4: Build**

Run from the repo root: `npm run build`
Expected: exit 0. The stepper is SSR-rendered and jsdom masks SSR errors, so this step is not optional.

- [ ] **Step 5: Bump the version**

In `packages/ci-frontend/package.json`, change `"version": "2.0.1"` to `"version": "2.1.0"`. Minor, not patch: this release carries both the review pills and the still-unpublished `feat(filter)` open-PR search match from commit 8e02a6d.

- [ ] **Step 6: Document the feature**

In `README.md`, extend the intro blockquote's feature list — currently "(workflow status, open PRs, deploy lanes, per-repo metrics, 24-hour trend)" — to include per-PR review signals, and note in one sentence that they appear only when the backend supplies `reviewSignals`.

- [ ] **Step 7: Commit**

```bash
git add packages/ci-frontend/package.json README.md
git commit -m "release: bump @fix-portal/ci-frontend to 2.1.0"
```

- [ ] **Step 8: Push once, then open the PR**

Only now, with every check above green:

```bash
pwsh -File C:/Users/chris/.claude/hooks/pr-gate-sentinel.ps1
git push -u origin feat/pr-review-status-pills
```

Then `gh pr create`, strip the injected emoji line from the PR body, and follow the review-gate loop the hook injects.

---

## Verification summary

| Spec requirement | Task |
|---|---|
| Optional `reviewSignals` field, tolerant of older backend | 1 |
| Four states with distinct meanings | 1, 3 |
| `pending` never renders as clean | 1, 2 |
| No reviewer names or label conventions in the library | 1, 2 (data-driven throughout) |
| Reuses the `.chip` system | 3 |
| Colour never the sole carrier | 2, 3 |
| `isAllowedHref` degradation, no dead anchors | 2 |
| `pending` / `disabled` never link | 2 |
| Stepper-only placement, `PullRequestList` untouched | 4 |
| Memoised against the 20s poll | 2 |
| Layer rules hold | 2 (step 5) |
| Released as a minor alongside `feat(filter)` | 5 |
