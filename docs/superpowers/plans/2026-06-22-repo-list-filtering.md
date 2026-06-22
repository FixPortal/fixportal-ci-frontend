# Repo-list filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a composable filter bar under the CI dashboard toolbar that narrows the repo list by name, visibility, CI status, and PR activity — combining with AND across groups, OR within a group.

**Architecture:** A pure `lib/applyRepoFilters.ts` owns all filter logic and the shared filter types. A `hooks/useRepoFilters.ts` owns localStorage-persisted state (namespaced like `useHideNoCi`). A presentational `components/RepoFilterBar.tsx` renders the bar from props. `pages/CiBoardContent.tsx` wires the hook, inserts `applyRepoFilters` into the `visibleRepos` memo chain after the existing Hide-No-CI filter, and renders the bar in the sticky band.

**Tech Stack:** React 19 function components, TypeScript, Vitest + @testing-library/react, CSS in `src/styles/board.css`.

## Global Constraints

- Package: `@fix-portal/ci-frontend`, monorepo path `packages/ci-frontend`. All paths below are relative to that package unless absolute.
- **Layer rules (enforced by `src/architecture.spec.ts`):** `lib/*` may import only `api/types` + sibling `lib/*`. `components/*` must NOT import hooks, contexts (`*Context.tsx`), or pages — props only. `hooks/*` may import `api` + contexts but not components/pages. Filter types therefore live in `lib/applyRepoFilters.ts`; the hook and the component import them from there.
- **No new dependencies.** Mirror existing patterns (`useHideNoCi`, `useCollapseState`, `lib/*.test.ts`).
- **No emoji** anywhere (code, copy, comments, commits).
- Persistence is best-effort: wrap every `localStorage` access in try/catch, swallow errors, fall back to defaults. Namespace the key with `storageNamespace` from `useCiConfig()`.
- **CI bucket mapping (resolved against `lib/worstState.ts` + `lib/isNoCi.ts`, matches `RepoActivityIndicator`):** for a repo, `isNoCi(repo)` → `no-ci`; otherwise `worstState(workflows.map(w => w.state))` where `'failure'` → `failing`, `'success'` → `passing`, and `'running'` / `'none'` (in-progress or all-unknown) → neither bucket (so such repos are excluded whenever any CI-status chip is selected).
- **Gate before any push:** `npx tsc -b --noEmit`, `npx vitest run`, and `npx vite build`, all green in the worktree.
- Vitest runs with cwd = `packages/ci-frontend`; run test commands from there.

---

## File Structure

- Create `src/lib/applyRepoFilters.ts` — pure filter function + shared types (`RepoFilters`, `Visibility`, `CiStatus`, `emptyFilters()`).
- Create `src/lib/applyRepoFilters.test.ts` — unit tests for the pure function.
- Create `src/hooks/useRepoFilters.ts` — persisted filter state + setters/togglers.
- Create `src/hooks/useRepoFilters.test.tsx` — persistence + setter behaviour.
- Create `src/components/RepoFilterBar.tsx` — presentational bar.
- Create `src/components/RepoFilterBar.test.tsx` — rendering + interaction.
- Modify `src/pages/CiBoardContent.tsx` — wire hook, memo chain, summary, empty state, render bar.
- Modify `src/styles/board.css` — filter-bar + chip styles, `state-msg__action`.

`src/index.ts` needs NO change — the new pieces are internal to `CiBoard`.

---

## Task 1: applyRepoFilters (pure lib + types)

**Files:**
- Create: `src/lib/applyRepoFilters.ts`
- Test: `src/lib/applyRepoFilters.test.ts`

**Interfaces:**
- Consumes: `RepositorySnapshot` from `../api/types`; `worstState` from `./worstState`; `isNoCi` from `./isNoCi`.
- Produces:
  - `type Visibility = 'public' | 'private'`
  - `type CiStatus = 'failing' | 'passing' | 'no-ci'`
  - `interface RepoFilters { search: string; visibility: Set<Visibility>; ciStatus: Set<CiStatus>; hasOpenPrs: boolean }`
  - `function emptyFilters(): RepoFilters` (fresh Sets each call — never a shared singleton)
  - `function applyRepoFilters(repos: RepositorySnapshot[], filters: RepoFilters): RepositorySnapshot[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/applyRepoFilters.test.ts
import { describe, it, expect } from 'vitest'
import type { RepositorySnapshot, SignalState } from '../api/types'
import { applyRepoFilters, emptyFilters, type RepoFilters } from './applyRepoFilters'

function repo(over: Partial<RepositorySnapshot>): RepositorySnapshot {
  return {
    name: 'fixportal-docs', htmlUrl: '', private: false,
    workflows: [], pullRequests: [], metrics: null, deploys: [], packages: [],
    ...over,
  }
}
function wf(state: SignalState) {
  return { name: 'ci', file: 'ci.yml', state, lastRun: null }
}
function filters(over: Partial<RepoFilters>): RepoFilters {
  return { ...emptyFilters(), ...over }
}

const failing = repo({ name: 'engine', workflows: [wf('failure')] })
const passing = repo({ name: 'portal', workflows: [wf('success')] })
const running = repo({ name: 'web', workflows: [wf('running')] })
const noCi = repo({ name: 'docs', workflows: [] })
const privatePassing = repo({ name: 'secret', private: true, workflows: [wf('success')] })
const withPr = repo({ name: 'review', workflows: [wf('success')], pullRequests: [
  { number: 1, title: 't', author: 'a', htmlUrl: '', isDraft: false, createdAt: '2026-01-01' },
] })
const all = [failing, passing, running, noCi, privatePassing, withPr]

describe('applyRepoFilters', () => {
  it('returns the input unchanged when no filters are active', () => {
    expect(applyRepoFilters(all, emptyFilters())).toEqual(all)
  })

  it('matches the search substring case-insensitively against repo name', () => {
    expect(applyRepoFilters(all, filters({ search: 'ENG' })).map(r => r.name)).toEqual(['engine'])
    expect(applyRepoFilters(all, filters({ search: '  ' }))).toEqual(all) // whitespace-only = no filter
  })

  it('filters by visibility (public only)', () => {
    const out = applyRepoFilters(all, filters({ visibility: new Set(['public']) }))
    expect(out).not.toContain(privatePassing)
    expect(out).toContain(passing)
  })

  it('within the CI-status group, OR across selected buckets', () => {
    const out = applyRepoFilters(all, filters({ ciStatus: new Set(['failing', 'no-ci']) }))
    expect(out.map(r => r.name).sort()).toEqual(['docs', 'engine'])
  })

  it('excludes running / all-unknown repos when any CI-status chip is selected', () => {
    const out = applyRepoFilters(all, filters({ ciStatus: new Set(['passing']) }))
    expect(out).not.toContain(running)
    expect(out.map(r => r.name).sort()).toEqual(['portal', 'review', 'secret'])
  })

  it('hasOpenPrs keeps only repos with >=1 open PR', () => {
    expect(applyRepoFilters(all, filters({ hasOpenPrs: true })).map(r => r.name)).toEqual(['review'])
  })

  it('ANDs across groups', () => {
    const out = applyRepoFilters(all, filters({
      visibility: new Set(['public']),
      ciStatus: new Set(['passing']),
      hasOpenPrs: true,
    }))
    expect(out.map(r => r.name)).toEqual(['review'])
  })

  it('yields an empty list when filters exclude everything', () => {
    expect(applyRepoFilters(all, filters({ ciStatus: new Set(['failing']), hasOpenPrs: true }))).toEqual([])
  })

  it('emptyFilters returns fresh Sets each call (no shared mutable state)', () => {
    const a = emptyFilters()
    const b = emptyFilters()
    a.visibility.add('public')
    expect(b.visibility.has('public')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/applyRepoFilters.test.ts`
Expected: FAIL — cannot resolve `./applyRepoFilters`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/applyRepoFilters.ts
import type { RepositorySnapshot } from '../api/types'
import { worstState } from './worstState'
import { isNoCi } from './isNoCi'

export type Visibility = 'public' | 'private'
export type CiStatus = 'failing' | 'passing' | 'no-ci'

// Filter state shape. Each Set empty (or boolean false / empty string) means
// "no constraint": within a group the selected members are ORed, and the groups
// are ANDed together. Sets, not arrays, so membership tests are O(1) and toggles
// are natural.
export interface RepoFilters {
  search: string
  visibility: Set<Visibility>
  ciStatus: Set<CiStatus>
  hasOpenPrs: boolean
}

// Fresh, independent Sets on every call. Never expose a shared singleton — a
// mutable default would leak state across hook instances and tests.
export function emptyFilters(): RepoFilters {
  return { search: '', visibility: new Set(), ciStatus: new Set(), hasOpenPrs: false }
}

// The CI bucket a repo belongs to, or null when it sits outside all buckets
// (workflows in progress / all-unknown). Mirrors RepoActivityIndicator's read of
// worstState so the filter agrees with the dot shown on each card.
function ciStatusOf(repo: RepositorySnapshot): CiStatus | null {
  if (isNoCi(repo)) return 'no-ci'
  const state = worstState((repo.workflows ?? []).map(w => w.state))
  if (state === 'failure') return 'failing'
  if (state === 'success') return 'passing'
  return null
}

// Pure, total filter over a repo list. Across groups: AND. Within a group: OR.
// Empty group = no constraint.
export function applyRepoFilters(
  repos: RepositorySnapshot[],
  filters: RepoFilters,
): RepositorySnapshot[] {
  const query = filters.search.trim().toLowerCase()
  return repos.filter(repo => {
    if (query && !repo.name.toLowerCase().includes(query)) return false
    if (filters.visibility.size > 0) {
      const v: Visibility = repo.private ? 'private' : 'public'
      if (!filters.visibility.has(v)) return false
    }
    if (filters.ciStatus.size > 0) {
      const bucket = ciStatusOf(repo)
      if (bucket === null || !filters.ciStatus.has(bucket)) return false
    }
    if (filters.hasOpenPrs && (repo.pullRequests?.length ?? 0) === 0) return false
    return true
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/applyRepoFilters.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```
git add src/lib/applyRepoFilters.ts src/lib/applyRepoFilters.test.ts
git commit -m "feat: add pure applyRepoFilters with filter types"
```

---

## Task 2: useRepoFilters hook

**Files:**
- Create: `src/hooks/useRepoFilters.ts`
- Test: `src/hooks/useRepoFilters.test.tsx`

**Interfaces:**
- Consumes: `RepoFilters`, `Visibility`, `CiStatus`, `emptyFilters` from `../lib/applyRepoFilters`; `useCiConfig` from `../CiConfigContext`.
- Produces a hook returning:
  - `filters: RepoFilters` (stable reference until a setter runs)
  - `setSearch(value: string): void`
  - `toggleVisibility(v: Visibility): void`
  - `toggleCiStatus(s: CiStatus): void`
  - `toggleHasOpenPrs(): void`
  - `clear(): void`
  - `isActive: boolean` (true when any filter constrains the list)

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useRepoFilters.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRepoFilters } from './useRepoFilters'

const KEY = 'ci-dashboard:repo-filters'

describe('useRepoFilters', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to empty, inactive filters', () => {
    const { result } = renderHook(() => useRepoFilters())
    expect(result.current.filters.search).toBe('')
    expect(result.current.filters.visibility.size).toBe(0)
    expect(result.current.isActive).toBe(false)
  })

  it('setSearch updates state, marks active, and persists', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.setSearch('engine'))
    expect(result.current.filters.search).toBe('engine')
    expect(result.current.isActive).toBe(true)
    expect(JSON.parse(localStorage.getItem(KEY)!).search).toBe('engine')
  })

  it('toggleVisibility adds then removes a member', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.toggleVisibility('private'))
    expect(result.current.filters.visibility.has('private')).toBe(true)
    act(() => result.current.toggleVisibility('private'))
    expect(result.current.filters.visibility.has('private')).toBe(false)
  })

  it('toggleCiStatus and toggleHasOpenPrs work and set isActive', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.toggleCiStatus('failing'))
    act(() => result.current.toggleHasOpenPrs())
    expect(result.current.filters.ciStatus.has('failing')).toBe(true)
    expect(result.current.filters.hasOpenPrs).toBe(true)
    expect(result.current.isActive).toBe(true)
  })

  it('clear resets every filter to default', () => {
    const { result } = renderHook(() => useRepoFilters())
    act(() => result.current.setSearch('x'))
    act(() => result.current.toggleCiStatus('passing'))
    act(() => result.current.clear())
    expect(result.current.isActive).toBe(false)
    expect(result.current.filters.ciStatus.size).toBe(0)
  })

  it('seeds from existing localStorage (Sets rehydrated from arrays)', () => {
    localStorage.setItem(KEY, JSON.stringify({ search: 'seed', visibility: ['public'], ciStatus: ['failing'], hasOpenPrs: true }))
    const { result } = renderHook(() => useRepoFilters())
    expect(result.current.filters.search).toBe('seed')
    expect(result.current.filters.visibility.has('public')).toBe(true)
    expect(result.current.filters.ciStatus.has('failing')).toBe(true)
    expect(result.current.filters.hasOpenPrs).toBe(true)
  })

  it('falls back to defaults on malformed JSON', () => {
    localStorage.setItem(KEY, '{not json')
    const { result } = renderHook(() => useRepoFilters())
    expect(result.current.isActive).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useRepoFilters.test.tsx`
Expected: FAIL — cannot resolve `./useRepoFilters`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useRepoFilters.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCiConfig } from '../CiConfigContext'
import {
  emptyFilters,
  type CiStatus,
  type RepoFilters,
  type Visibility,
} from '../lib/applyRepoFilters'

const DEFAULT_KEY = 'ci-dashboard:repo-filters'

interface Persisted {
  search?: string
  visibility?: Visibility[]
  ciStatus?: CiStatus[]
  hasOpenPrs?: boolean
}

function load(key: string): RepoFilters {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyFilters()
    const p = JSON.parse(raw) as Persisted
    return {
      search: typeof p.search === 'string' ? p.search : '',
      visibility: new Set(Array.isArray(p.visibility) ? p.visibility : []),
      ciStatus: new Set(Array.isArray(p.ciStatus) ? p.ciStatus : []),
      hasOpenPrs: p.hasOpenPrs === true,
    }
  } catch {
    return emptyFilters()
  }
}

function save(key: string, f: RepoFilters) {
  try {
    localStorage.setItem(key, JSON.stringify({
      search: f.search,
      visibility: [...f.visibility],
      ciStatus: [...f.ciStatus],
      hasOpenPrs: f.hasOpenPrs,
    }))
  } catch {
    // ignore (private mode / quota) — filter state is best-effort
  }
}

function toggleIn<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

// Persisted repo-filter state, namespaced per host exactly like useHideNoCi /
// useCollapseState. Sets are serialised as arrays.
export function useRepoFilters() {
  const { storageNamespace } = useCiConfig()
  const key = storageNamespace ? `${DEFAULT_KEY}:${storageNamespace}` : DEFAULT_KEY
  const [filters, setFilters] = useState<RepoFilters>(() => load(key))

  useEffect(() => {
    save(key, filters)
  }, [key, filters])

  const setSearch = useCallback((search: string) => setFilters(f => ({ ...f, search })), [])
  const toggleVisibility = useCallback(
    (v: Visibility) => setFilters(f => ({ ...f, visibility: toggleIn(f.visibility, v) })),
    [],
  )
  const toggleCiStatus = useCallback(
    (s: CiStatus) => setFilters(f => ({ ...f, ciStatus: toggleIn(f.ciStatus, s) })),
    [],
  )
  const toggleHasOpenPrs = useCallback(() => setFilters(f => ({ ...f, hasOpenPrs: !f.hasOpenPrs })), [])
  const clear = useCallback(() => setFilters(emptyFilters()), [])

  const isActive = useMemo(
    () => filters.search.trim() !== '' || filters.visibility.size > 0 || filters.ciStatus.size > 0 || filters.hasOpenPrs,
    [filters],
  )

  return { filters, setSearch, toggleVisibility, toggleCiStatus, toggleHasOpenPrs, clear, isActive }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useRepoFilters.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```
git add src/hooks/useRepoFilters.ts src/hooks/useRepoFilters.test.tsx
git commit -m "feat: add persisted useRepoFilters hook"
```

---

## Task 3: RepoFilterBar component

**Files:**
- Create: `src/components/RepoFilterBar.tsx`
- Test: `src/components/RepoFilterBar.test.tsx`

**Interfaces:**
- Consumes types `RepoFilters`, `Visibility`, `CiStatus` from `../lib/applyRepoFilters` (components may import lib).
- Produces `RepoFilterBar` (default-exported-as-named `export function RepoFilterBar`), memoised with `React.memo`, props:
  - `filters: RepoFilters`
  - `isAdmin: boolean`
  - `onSearch(value: string): void`
  - `onToggleVisibility(v: Visibility): void`
  - `onToggleCiStatus(s: CiStatus): void`
  - `onToggleHasOpenPrs(): void`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/RepoFilterBar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { emptyFilters } from '../lib/applyRepoFilters'
import { RepoFilterBar } from './RepoFilterBar'

function setup(over: Partial<Parameters<typeof RepoFilterBar>[0]> = {}) {
  const props = {
    filters: emptyFilters(),
    isAdmin: true,
    onSearch: vi.fn(),
    onToggleVisibility: vi.fn(),
    onToggleCiStatus: vi.fn(),
    onToggleHasOpenPrs: vi.fn(),
    ...over,
  }
  render(<RepoFilterBar {...props} />)
  return props
}

describe('RepoFilterBar', () => {
  it('renders the visibility group for admins', () => {
    setup({ isAdmin: true })
    expect(screen.getByRole('button', { name: /public/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument()
  })

  it('hides the visibility group for non-admins but keeps the rest', () => {
    setup({ isAdmin: false })
    expect(screen.queryByRole('button', { name: /^public$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /failing/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /has prs/i })).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('fires onSearch as the user types', async () => {
    const { onSearch } = setup()
    await userEvent.type(screen.getByRole('searchbox'), 'a')
    expect(onSearch).toHaveBeenCalledWith('a')
  })

  it('fires the matching toggle handler when a chip is clicked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /failing/i }))
    expect(props.onToggleCiStatus).toHaveBeenCalledWith('failing')
    await userEvent.click(screen.getByRole('button', { name: /has prs/i }))
    expect(props.onToggleHasOpenPrs).toHaveBeenCalled()
  })

  it('reflects selected state via aria-pressed', () => {
    const filters = emptyFilters()
    filters.ciStatus.add('failing')
    setup({ filters })
    expect(screen.getByRole('button', { name: /failing/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /passing/i })).toHaveAttribute('aria-pressed', 'false')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/RepoFilterBar.test.tsx`
Expected: FAIL — cannot resolve `./RepoFilterBar`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/RepoFilterBar.tsx
import { memo } from 'react'
import type { CiStatus, RepoFilters, Visibility } from '../lib/applyRepoFilters'

interface RepoFilterBarProps {
  filters: RepoFilters
  isAdmin: boolean
  onSearch: (value: string) => void
  onToggleVisibility: (v: Visibility) => void
  onToggleCiStatus: (s: CiStatus) => void
  onToggleHasOpenPrs: () => void
}

// `tone` maps a chip to a status colour class so Failing reads red and Passing
// green, matching the board's status palette; others use the neutral accent.
function Chip(props: {
  label: string
  pressed: boolean
  tone?: 'failing' | 'passing'
  onClick: () => void
}) {
  const tone = props.tone ? ` repo-filter__chip--${props.tone}` : ''
  return (
    <button
      type="button"
      className={`repo-filter__chip${tone}${props.pressed ? ' repo-filter__chip--on' : ''}`}
      aria-pressed={props.pressed}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}

// Presentational filter bar. All state and persistence live in useRepoFilters;
// this component is pure props in, callbacks out (architecture: components never
// touch hooks or contexts).
function RepoFilterBarImpl({
  filters,
  isAdmin,
  onSearch,
  onToggleVisibility,
  onToggleCiStatus,
  onToggleHasOpenPrs,
}: RepoFilterBarProps) {
  return (
    <div className="dashboard__filter-bar" role="group" aria-label="Filter repositories">
      <input
        type="search"
        className="repo-filter__search"
        placeholder="Filter repos…"
        aria-label="Filter repos by name"
        value={filters.search}
        onChange={e => onSearch(e.target.value)}
      />

      {isAdmin && (
        <>
          <span className="repo-filter__divider" aria-hidden="true" />
          <div className="repo-filter__group" role="group" aria-label="Visibility">
            <span className="repo-filter__label">Visibility</span>
            <Chip label="Public" pressed={filters.visibility.has('public')} onClick={() => onToggleVisibility('public')} />
            <Chip label="Private" pressed={filters.visibility.has('private')} onClick={() => onToggleVisibility('private')} />
          </div>
        </>
      )}

      <span className="repo-filter__divider" aria-hidden="true" />
      <div className="repo-filter__group" role="group" aria-label="CI Status">
        <span className="repo-filter__label">CI Status</span>
        <Chip label="Failing" tone="failing" pressed={filters.ciStatus.has('failing')} onClick={() => onToggleCiStatus('failing')} />
        <Chip label="Passing" tone="passing" pressed={filters.ciStatus.has('passing')} onClick={() => onToggleCiStatus('passing')} />
        <Chip label="No-CI" pressed={filters.ciStatus.has('no-ci')} onClick={() => onToggleCiStatus('no-ci')} />
      </div>

      <span className="repo-filter__divider" aria-hidden="true" />
      <Chip label="Has PRs" pressed={filters.hasOpenPrs} onClick={onToggleHasOpenPrs} />
    </div>
  )
}

export const RepoFilterBar = memo(RepoFilterBarImpl)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/RepoFilterBar.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```
git add src/components/RepoFilterBar.tsx src/components/RepoFilterBar.test.tsx
git commit -m "feat: add presentational RepoFilterBar component"
```

---

## Task 4: Wire into CiBoardContent + styles

**Files:**
- Modify: `src/pages/CiBoardContent.tsx`
- Modify: `src/styles/board.css`
- Test: `src/pages/CiBoardContent.test.tsx` (create if absent; otherwise extend)

**Interfaces:**
- Consumes: `useRepoFilters` (Task 2), `applyRepoFilters` (Task 1), `RepoFilterBar` (Task 3).

- [ ] **Step 1: Write the failing test (empty-state + filtered grouping)**

First check whether `src/pages/CiBoardContent.test.tsx` exists. If a test harness for `CiBoardContent` already exists, add these cases to it reusing its snapshot-provider setup. If not, create the file below. It renders `CiBoard` with a stubbed snapshot via `CiConfigProvider`'s `snapshotFetcher`, types into the search box, and asserts the empty-state message + Clear action appear.

```tsx
// src/pages/CiBoardContent.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach } from 'vitest'
import type { DashboardSnapshot } from '../api/types'
import { CiBoard } from '../CiBoard'
import { CiConfigProvider } from '../CiConfigContext'
import { CiAdminProvider } from '../CiAdminContext'

const snapshot: DashboardSnapshot = {
  refreshedAt: new Date().toISOString(),
  org: 'FixPortal',
  repositories: [
    { name: 'engine', htmlUrl: '', private: false, workflows: [{ name: 'ci', file: 'ci.yml', state: 'failure', lastRun: null }], pullRequests: [], metrics: null, deploys: [], packages: [] },
    { name: 'portal', htmlUrl: '', private: false, workflows: [{ name: 'ci', file: 'ci.yml', state: 'success', lastRun: null }], pullRequests: [], metrics: null, deploys: [], packages: [] },
  ],
  summary: [],
  lastMergedPr: null,
}

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CiAdminProvider value={true}>
        <CiConfigProvider value={{ apiBase: '', snapshotFetcher: async () => snapshot, adminSnapshotFetcher: async () => snapshot, storageNamespace: 'test' }}>
          <CiBoard />
        </CiConfigProvider>
      </CiAdminProvider>
    </QueryClientProvider>,
  )
}

describe('CiBoardContent filtering', () => {
  beforeEach(() => localStorage.clear())

  it('shows the filtered empty state with a Clear filters action when nothing matches', async () => {
    renderBoard()
    expect(await screen.findByText('engine')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'zzz-no-match')
    expect(await screen.findByText(/no repositories match the current filters/i)).toBeInTheDocument()
    const clear = screen.getByRole('button', { name: /clear filters/i })
    await userEvent.click(clear)
    expect(await screen.findByText('engine')).toBeInTheDocument()
  })

  it('narrows the board when a CI-status chip is selected', async () => {
    renderBoard()
    expect(await screen.findByText('portal')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /failing/i }))
    expect(screen.queryByText('portal')).not.toBeInTheDocument()
    expect(screen.getByText('engine')).toBeInTheDocument()
  })
})
```

Note: confirm `CiBoard` mounts `CiBoardContent` and that the stubbed `snapshotFetcher`/`adminSnapshotFetcher` resolve a snapshot. If `CiBoard` needs other providers, mirror whatever an existing page/component test in this repo uses. If no existing snapshot-render test exists to copy from, prefer a thinner test that renders `CiBoardContent` directly wrapped only in the providers it reads (`CiConfigProvider`, `CiAdminProvider`, `QueryClientProvider`) and stubs `useDashboardSnapshot` by supplying data through the fetcher.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/CiBoardContent.test.tsx`
Expected: FAIL — empty-state message text / Clear button not found (filters not wired yet).

- [ ] **Step 3: Wire the hook and memo chain in `CiBoardContent.tsx`**

Add imports near the existing ones:

```tsx
import { useRepoFilters } from '../hooks/useRepoFilters'
import { applyRepoFilters } from '../lib/applyRepoFilters'
import { RepoFilterBar } from '../components/RepoFilterBar'
```

Call the hook alongside the others (after `const hideNoCi = useHideNoCi()`):

```tsx
  const filters = useRepoFilters()
```

Replace the existing `visibleRepos` memo with a two-stage chain — keep the Hide-No-CI result as `noCiFiltered`, then apply the new filters to produce `visibleRepos` (so all downstream consumers, which already read `visibleRepos`, follow for free):

```tsx
  const noCiFiltered = useMemo(
    () => applyNoCiFilter(repositories, hideNoCi.hidden),
    [repositories, hideNoCi.hidden],
  )
  const visibleRepos = useMemo(
    () => applyRepoFilters(noCiFiltered, filters.filters),
    [noCiFiltered, filters.filters],
  )
```

Update the `summary` memo so an active filter forces a recompute from the filtered set (the server summary describes the unfiltered repo set):

```tsx
  const summary = useMemo(() => {
    if (isAdmin && !hideNoCi.hidden && !filters.isActive) return snapshot.data?.summary ?? []
    return computeSummary(visibleRepos)
  }, [isAdmin, hideNoCi.hidden, filters.isActive, snapshot.data, visibleRepos])
```

Fix the Hide-No-CI button's hidden-count so it counts only No-CI-hidden repos, not filter-removed ones. Replace the existing `const hiddenCount = repositories.length - visibleRepos.length` line with:

```tsx
  const hiddenCount = repositories.length - noCiFiltered.length
```

- [ ] **Step 4: Add the filtered empty-state branch and render the bar**

Update `buildRepoList`'s signature and its zero-length branch to handle the filtered case first. Change the signature to accept `filtersActive` and `onClearFilters`:

```tsx
function buildRepoList(
  visibleRepos: RepositorySnapshot[],
  publicRepos: RepositorySnapshot[],
  privateRepos: RepositorySnapshot[],
  showGroups: boolean,
  isNoCiHidden: boolean,
  collapse: ReturnType<typeof useCollapseState>,
  filtersActive: boolean,
  onClearFilters: () => void,
) {
  if (visibleRepos.length === 0) {
    if (filtersActive) {
      return (
        <div className="state-msg">
          No repositories match the current filters.{' '}
          <button type="button" className="state-msg__action" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      )
    }
    if (isNoCiHidden) {
      return <div className="state-msg">All repositories are No-CI — hidden.</div>
    }
    return <div className="state-msg">No repositories found.</div>
  }
  // ...unchanged grouping body...
```

Update the call site to pass the two new args:

```tsx
  const repoListContent = buildRepoList(
    visibleRepos, publicRepos, privateRepos, showGroups, hideNoCi.hidden, collapse,
    filters.isActive, filters.clear,
  )
```

Render `<RepoFilterBar>` inside the sticky band, directly after the `.dashboard__toolbar` div and before `<SummaryStrip>`:

```tsx
      </div>
      <RepoFilterBar
        filters={filters.filters}
        isAdmin={isAdmin}
        onSearch={filters.setSearch}
        onToggleVisibility={filters.toggleVisibility}
        onToggleCiStatus={filters.toggleCiStatus}
        onToggleHasOpenPrs={filters.toggleHasOpenPrs}
      />
      <SummaryStrip
```

(The `</div>` above closes `.dashboard__toolbar`; insert the bar between that close and `<SummaryStrip>`.)

- [ ] **Step 5: Add styles to `src/styles/board.css`**

Append after the `.dashboard__hide-noci--on:hover` block (around line 444), inside the same top-level rule scope as the other `.dashboard__*` rules:

```css
  /* ---- Filter bar ---------------------------------------------------------- */

  .dashboard__filter-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .repo-filter__search {
    font-family: var(--font-sans);
    font-size: var(--fs-13);
    color: var(--text);
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: var(--r-chip);
    padding: var(--space-2) var(--space-3);
    min-width: 180px;
  }
  .repo-filter__search:focus { outline: none; border-color: var(--border-strong); }

  .repo-filter__group {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .repo-filter__label {
    font-family: var(--font-mono);
    font-size: var(--fs-11);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .repo-filter__divider {
    width: 1px;
    align-self: stretch;
    min-height: 1.4em;
    background: var(--border);
  }

  .repo-filter__chip {
    font-family: var(--font-mono);
    font-size: var(--fs-11);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: var(--r-chip);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    white-space: nowrap;
  }
  .repo-filter__chip:hover { border-color: var(--border-strong); }
  .repo-filter__chip--on {
    color: var(--brand);
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 16%, transparent);
  }
  .repo-filter__chip--failing.repo-filter__chip--on {
    color: var(--bad-solid);
    border-color: var(--bad-solid);
    background: color-mix(in srgb, var(--bad-solid) 16%, transparent);
  }
  .repo-filter__chip--passing.repo-filter__chip--on {
    color: var(--ok-border);
    border-color: var(--ok-border);
    background: color-mix(in srgb, var(--ok-border) 16%, transparent);
  }

  .state-msg__action {
    font: inherit;
    color: var(--brand);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }
```

If any token referenced above (`--fs-13`, `--space-*`) is not defined, substitute the nearest existing token used by neighbouring rules (e.g. `.dashboard__hide-noci` uses `--fs-11`, `--space-2`, `--space-3`). Verify against `tokens.css` / the top of `board.css` while editing.

- [ ] **Step 6: Run the targeted tests to verify they pass**

Run: `npx vitest run src/pages/CiBoardContent.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full gate**

Run each, all must be green:

```
npx tsc -b --noEmit
npx vitest run
npx vite build
```

- [ ] **Step 8: Commit**

```
git add src/pages/CiBoardContent.tsx src/styles/board.css src/pages/CiBoardContent.test.tsx
git commit -m "feat: wire repo filters into the CI board with filter bar and empty state"
```

---

## Post-merge (out of plan scope, do after PR merges)

Bump `packages/ci-frontend/package.json` `1.4.0 → 1.5.0` (minor — backward-compatible feature) and republish via the OIDC trusted-publisher flow. See memory `project-npm-publish-0.2.0`.

---

## Self-Review

- **Spec coverage:** filter bar under toolbar in sticky band (Task 4 render) ✓; search/visibility/CI-status/Has-PRs (Task 3) ✓; across-AND/within-OR/empty=no-constraint (Task 1) ✓; Hide-No-CI unchanged and composes via AND (Task 4 keeps `applyNoCiFilter` then `applyRepoFilters`) ✓; visibility hidden for guests (Task 3 `isAdmin` gate) ✓; pure `applyRepoFilters` + persisted hook + memoised presentational component (Tasks 1-3) ✓; memo chain after `applyNoCiFilter` feeding summary/grouping/openPrs/stepper (Task 4 — downstream reads `visibleRepos`) ✓; empty-state message + Clear-filters resetting only new filters (Task 4) ✓; CI bucket mapping resolved (Global Constraints) ✓; persistence best-effort + namespaced (Task 2) ✓.
- **Type consistency:** `RepoFilters`/`Visibility`/`CiStatus`/`emptyFilters` defined in Task 1, imported unchanged in Tasks 2-3; hook return shape in Task 2 matches the props wired in Task 4; `RepoFilterBar` props in Task 3 match the Task 4 call site.
- **Out of scope (YAGNI):** no presets, no sorting, no URL state, no metric/age/language filters — none added.
