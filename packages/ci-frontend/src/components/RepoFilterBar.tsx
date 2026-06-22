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
    <div className="dashboard__filter-bar" role="search" aria-label="Filter repositories">
      <input
        type="search"
        className="repo-filter__search"
        placeholder="Filter repos..."
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
