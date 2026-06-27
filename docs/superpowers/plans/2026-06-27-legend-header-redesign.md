# Legend + Scope Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scrolling footer legends with a collapsible row in the sticky header, and make the scope text reflect the active filter state.

**Architecture:** A new `LegendRow` component holds the toggle state and renders both the Status and Lizard metrics key inline below `SummaryStrip` when expanded. `CiBoardContent` derives a boolean `isScopeFiltered` from the existing `filters.isActive` and `hideNoCi.hidden` signals and uses it to switch the scope text between the static label and a live count.

**Tech Stack:** React 19, TypeScript, Vitest 4, `@testing-library/react` 16, CSS custom properties (no Tailwind — this package uses bespoke board.css).

## Global Constraints

- No new npm dependencies.
- All Vitest imports must be explicit — `globals: false` in vitest config. Always import `describe`, `it`, `expect`, `beforeEach` from `'vitest'`.
- CSS custom properties: `--fs-11`, `--fs-12`, `--space-1` through `--space-6`, `--run`, `--ok-border`, `--bad-solid`, `--unknown`, `--no-ci`, `--card-bg`, `--border`, `--border-strong`, `--text-muted`, `--text-faint` are all defined in the package; do not hardcode hex values.
- Run `npm run lint` from repo root, then `npm test` from `packages/ci-frontend/`, then `npx tsc --noEmit` from `packages/ci-frontend/` — all three must pass before every commit.
- Commits use conventional-commit prefixes (`feat:`, `fix:`, `chore:`). No emoji in commit messages or PR bodies.

---

## File Map

| Action | Path |
|---|---|
| **Create** | `packages/ci-frontend/src/components/LegendRow.tsx` |
| **Create** | `packages/ci-frontend/src/components/LegendRow.test.tsx` |
| **Modify** | `packages/ci-frontend/src/pages/CiBoardContent.tsx` |
| **Modify** | `packages/ci-frontend/src/styles/board.css` |
| **Modify** | `packages/ci-frontend/src/pages/CiBoardContent.test.tsx` |
| **Delete** | `packages/ci-frontend/src/components/StatusLegend.tsx` |
| **Delete** | `packages/ci-frontend/src/components/StatusLegend.test.tsx` |
| **Delete** | `packages/ci-frontend/src/components/MetricsLegend.tsx` |

---

## Task 1: LegendRow component

**Files:**
- Create: `packages/ci-frontend/src/components/LegendRow.tsx`
- Create: `packages/ci-frontend/src/components/LegendRow.test.tsx`

**Interfaces:**
- Produces: `export function LegendRow(): JSX.Element` — no props, self-contained toggle state.

---

- [ ] **Step 1: Write the failing tests**

Create `packages/ci-frontend/src/components/LegendRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { LegendRow } from './LegendRow'

describe('LegendRow', () => {
  it('renders collapsed by default', () => {
    render(<LegendRow />)
    expect(screen.getByRole('button', { name: /legend/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('passing')).not.toBeInTheDocument()
  })

  it('expands and shows all status items on toggle', async () => {
    render(<LegendRow />)
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    expect(screen.getByRole('button', { name: /legend/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('passing')).toBeInTheDocument()
    expect(screen.getByText('failing')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('No-CI')).toBeInTheDocument()
  })

  it('expands and shows Lizard metric definitions on toggle', async () => {
    render(<LegendRow />)
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    expect(screen.getByText(/non-comment lines/)).toBeInTheDocument()
    expect(screen.getByText(/cyclomatic complexity/)).toBeInTheDocument()
    expect(screen.getByText(/functions over CCN/)).toBeInTheDocument()
  })

  it('collapses again on second click', async () => {
    render(<LegendRow />)
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    await userEvent.click(screen.getByRole('button', { name: /legend/i }))
    expect(screen.queryByText('passing')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```
cd packages/ci-frontend
npm test -- --reporter=verbose LegendRow
```

Expected: 4 failures — `LegendRow` not found.

- [ ] **Step 3: Implement LegendRow**

Create `packages/ci-frontend/src/components/LegendRow.tsx`:

```tsx
import { useState } from 'react'
import type { SignalState } from '../api/types'

const STATUS_ITEMS: ReadonlyArray<readonly [SignalState, string]> = [
  ['success', 'passing'],
  ['failure', 'failing'],
  ['running', 'running'],
  ['unknown', 'unknown'],
]

export function LegendRow() {
  const [open, setOpen] = useState(false)
  return (
    <div className="legend-row">
      <button
        type="button"
        className="legend-row__toggle"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        Legend {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="legend-row__content">
          <div className="legend-row__status">
            <span className="legend-row__label">Status</span>
            {STATUS_ITEMS.map(([state, label]) => (
              <span key={state} className="legend-row__item">
                <span className="legend-row__dot" data-state={state} aria-hidden="true" />
                {label}
              </span>
            ))}
            <span className="legend-row__item">
              <span className="legend-row__noci" aria-hidden="true" />
              No-CI
            </span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span className="legend-row__gloss">
              <b>CI</b> = workflow runs · <b>CD</b> = deploys &amp; packages
            </span>
          </div>
          <div className="legend-row__metrics">
            <span className="legend-row__label">Lizard metrics</span>
          </div>
          <div className="legend-row__defs">
            <span><b>NLOC</b> non-comment lines</span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span><b>avg CCN</b> cyclomatic complexity</span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span><b>functions</b> count</span>
            <span className="legend-row__sep" aria-hidden="true">·</span>
            <span><b>complex</b> functions over CCN&nbsp;15</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```
cd packages/ci-frontend
npm test -- --reporter=verbose LegendRow
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```
git add packages/ci-frontend/src/components/LegendRow.tsx packages/ci-frontend/src/components/LegendRow.test.tsx
git commit -m "feat(legend): add collapsible LegendRow component"
```

---

## Task 2: Wire LegendRow into the board — remove old legend components

**Files:**
- Modify: `packages/ci-frontend/src/pages/CiBoardContent.tsx`
- Modify: `packages/ci-frontend/src/styles/board.css`
- Delete: `packages/ci-frontend/src/components/StatusLegend.tsx`
- Delete: `packages/ci-frontend/src/components/StatusLegend.test.tsx`
- Delete: `packages/ci-frontend/src/components/MetricsLegend.tsx`

**Interfaces:**
- Consumes: `LegendRow` from `./LegendRow` (Task 1)

---

- [ ] **Step 1: Swap imports and JSX in CiBoardContent.tsx**

In `packages/ci-frontend/src/pages/CiBoardContent.tsx`:

Replace these two import lines:
```tsx
import { MetricsLegend } from '../components/MetricsLegend'
import { StatusLegend } from '../components/StatusLegend'
```
With:
```tsx
import { LegendRow } from '../components/LegendRow'
```

In the return JSX, the current structure is:
```tsx
      </div>
      <div className="repo-list">
        {repoListContent}
      </div>
      <StatusLegend />
      <MetricsLegend />
```

Replace with:
```tsx
      </div>
      <div className="repo-list">
        {repoListContent}
      </div>
```

And inside `.dashboard__sticky`, directly after `<SummaryStrip ... />` (line ~256) and before the closing `</div>`, add:
```tsx
      <LegendRow />
```

The final `.dashboard__sticky` block should look like:
```tsx
      <div className="dashboard__sticky">
      <div className="dashboard__toolbar">
        {/* ... toolbar content unchanged ... */}
      </div>
      <RepoFilterBar ... />
      <SummaryStrip ... />
      <LegendRow />
      </div>
```

- [ ] **Step 2: Delete the old legend source files**

```
git rm packages/ci-frontend/src/components/StatusLegend.tsx
git rm packages/ci-frontend/src/components/StatusLegend.test.tsx
git rm packages/ci-frontend/src/components/MetricsLegend.tsx
```

- [ ] **Step 3: Replace the legend CSS in board.css**

Find and remove the entire block from the comment `/* ---- Status legend` through the end of the `.metrics-legend__item b` rule (lines ~806–900 in board.css). These are the classes: `.status-legend`, `.status-legend__title`, `.status-legend__item`, `.status-legend__dot` (and its `[data-state]` variants), `.status-legend__noci`, `.status-legend__gloss`, `.status-legend + .metrics-legend`, `.metrics-legend`, `.metrics-legend__title`, `.metrics-legend__item b`.

After removing those blocks, add the following new block in their place (keep it inside the `.ci-embed { ... }` wrapper that surrounds all board styles):

```css
  /* ---- Collapsible legend row (sticky header, below SummaryStrip) ---------- */
  .legend-row {
    border-top: 1px solid var(--border);
    padding-top: var(--space-2);
    margin-top: var(--space-2);
  }

  .legend-row__toggle {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: var(--fs-12);
    font-weight: 600;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
  }

  .legend-row__toggle:hover {
    color: var(--text);
  }

  .legend-row__content {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-bottom: var(--space-2);
  }

  .legend-row__status,
  .legend-row__metrics,
  .legend-row__defs {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    font-size: var(--fs-11);
    color: var(--text-muted);
  }

  .legend-row__label {
    font-weight: 600;
    min-width: 5rem;
    color: var(--text-muted);
  }

  .legend-row__item {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .legend-row__dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--unknown);
  }

  .legend-row__dot[data-state="success"] {
    background: var(--ok-border);
  }

  .legend-row__dot[data-state="failure"] {
    background: var(--bad-solid);
    border-radius: 2px;
  }

  .legend-row__dot[data-state="running"] {
    background: var(--run);
  }

  .legend-row__dot[data-state="unknown"] {
    background: transparent;
    border: 1.5px dashed var(--unknown);
  }

  .legend-row__noci {
    flex: none;
    width: 18px;
    height: 8px;
    border-left: 3px solid var(--no-ci);
    background: var(--card-bg);
  }

  .legend-row__sep {
    color: var(--border-strong);
  }

  .legend-row__gloss b {
    color: var(--text-muted);
    font-weight: 600;
  }

  .legend-row__defs {
    padding-left: 5.4rem;
    color: var(--text-faint);
  }
```

- [ ] **Step 4: Run full check suite**

```
cd packages/ci-frontend
npm test
```

```
cd packages/ci-frontend
npx tsc --noEmit
```

From repo root:
```
npm run lint
```

Expected: all pass. If `StatusLegend` or `MetricsLegend` appear in any import or test, fix them now.

- [ ] **Step 5: Commit**

```
git add packages/ci-frontend/src/pages/CiBoardContent.tsx packages/ci-frontend/src/styles/board.css
git commit -m "feat(legend): wire LegendRow into sticky header, remove footer legends"
```

---

## Task 3: Dynamic scope text

**Files:**
- Modify: `packages/ci-frontend/src/pages/CiBoardContent.tsx`
- Modify: `packages/ci-frontend/src/styles/board.css`
- Modify: `packages/ci-frontend/src/pages/CiBoardContent.test.tsx`

**Interfaces:**
- Consumes: `filters.isActive: boolean` and `hideNoCi.hidden: boolean` (already in scope in `CiBoardContent`), `visibleRepos: RepositorySnapshot[]`, `repositories: RepositorySnapshot[]`.

---

- [ ] **Step 1: Write the failing tests**

Open `packages/ci-frontend/src/pages/CiBoardContent.test.tsx`. Add a new `describe` block after the existing one:

```tsx
describe('CiBoardContent scope text', () => {
  beforeEach(() => localStorage.clear())

  it('shows static "all repositories" scope when no filters are active', async () => {
    renderBoard()
    expect(await screen.findByText(/all repositories/)).toBeInTheDocument()
  })

  it('shows live count in scope when a filter chip is active', async () => {
    renderBoard()
    expect(await screen.findByText('engine')).toBeInTheDocument()
    const bar = screen.getByRole('search')
    await userEvent.click(within(bar).getByRole('button', { name: /failing/i }))
    expect(await screen.findByText(/1 of 2 repositories/)).toBeInTheDocument()
  })

  it('reverts to static scope when filters are cleared', async () => {
    renderBoard()
    expect(await screen.findByText('engine')).toBeInTheDocument()
    const bar = screen.getByRole('search')
    await userEvent.click(within(bar).getByRole('button', { name: /failing/i }))
    expect(await screen.findByText(/1 of 2 repositories/)).toBeInTheDocument()
    await userEvent.click(within(bar).getByRole('button', { name: /failing/i }))
    expect(await screen.findByText(/all repositories/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm the new tests fail**

```
cd packages/ci-frontend
npm test -- --reporter=verbose CiBoardContent
```

Expected: the 2 existing tests pass; the 3 new `scope text` tests fail — "1 of 2 repositories" not found.

- [ ] **Step 3: Add isScopeFiltered and update the scope span in CiBoardContent.tsx**

In `packages/ci-frontend/src/pages/CiBoardContent.tsx`, after line 198 (`const allCollapsed = ...`) and before line 199, add:

```tsx
  const isScopeFiltered = filters.isActive || hideNoCi.hidden
```

Replace the existing scope span (currently at line ~217):
```tsx
        <span className="dashboard__scope">{snapshot.data.org} · {isAdmin && hasAdminSource ? 'all repositories' : 'public repositories'}</span>
```

With:
```tsx
        <span className="dashboard__scope">
          {snapshot.data.org}
          {isScopeFiltered
            ? (
              <> · <span className="dashboard__scope-count">
                {visibleRepos.length} of {repositories.length} repositories
              </span></>
            )
            : ` · ${isAdmin && hasAdminSource ? 'all repositories' : 'public repositories'}`
          }
        </span>
```

- [ ] **Step 4: Add the scope count colour rule to board.css**

Inside the `.ci-embed { ... }` block in `board.css`, after the `.dashboard__scope` rule (currently ends around line 173), add:

```css
  .dashboard__scope-count {
    color: var(--run);
  }
```

- [ ] **Step 5: Run tests — confirm all pass**

```
cd packages/ci-frontend
npm test -- --reporter=verbose CiBoardContent
```

Expected: 5 passing (2 existing + 3 new scope text tests).

- [ ] **Step 6: Run full check suite**

```
cd packages/ci-frontend
npm test
```

```
cd packages/ci-frontend
npx tsc --noEmit
```

From repo root:
```
npm run lint
```

Expected: all pass.

- [ ] **Step 7: Commit**

```
git add packages/ci-frontend/src/pages/CiBoardContent.tsx packages/ci-frontend/src/styles/board.css packages/ci-frontend/src/pages/CiBoardContent.test.tsx
git commit -m "feat(board): dynamic scope text shows live count when filters are active"
```

---

## Self-Review Checklist

- [x] **Spec coverage** — collapsible legend row: Task 1 + 2. Dynamic scope text: Task 3. StatusLegend/MetricsLegend deletion: Task 2 Step 2. CSS removal: Task 2 Step 3. Thematic toggle: Task 1 (aria-expanded). Count trigger (filters OR hideNoCi): Task 3 Step 3. Count colour (--run): Task 3 Step 4.
- [x] **No placeholders** — all steps have real code.
- [x] **Type consistency** — `LegendRow` produced in Task 1, consumed in Task 2. `isScopeFiltered`, `visibleRepos`, `repositories` all already in scope in `CiBoardContent`; no new props or interfaces needed.
- [x] **Test coverage** — LegendRow: collapse/expand/content/re-collapse. Scope text: static/filtered/cleared.
