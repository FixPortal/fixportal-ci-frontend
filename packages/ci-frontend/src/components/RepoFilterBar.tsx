// src/components/RepoFilterBar.tsx
import React, { memo } from 'react'
import { FilterChip } from './FilterChip'
import type { CiStatus, RepoFilters, Visibility } from '../lib/applyRepoFilters'

const fieldsetStyle: React.CSSProperties = {
  border: 'none',
  margin: 0,
  padding: 0,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
}

interface RepoFilterBarProps {
  filters: RepoFilters
  isAdmin: boolean
  onToggleVisibility: (v: Visibility) => void
  onToggleCiStatus: (s: CiStatus) => void
  onToggleHasOpenPrs: () => void
}

// Presentational filter bar. All state and persistence live in useRepoFilters;
// this component is pure props in, callbacks out (architecture: components never
// touch hooks or contexts).
//
// The search box and the Ready to merge chip are NOT here — they sit together in
// the toolbar row above, which has the spare width this row does not: with both
// rows competing, this one overflowed and dropped its longest chip onto a line of
// its own.
function RepoFilterBarImpl({
  filters,
  isAdmin,
  onToggleVisibility,
  onToggleCiStatus,
  onToggleHasOpenPrs,
}: RepoFilterBarProps) {
  return (
    <search role="search" className="dashboard__filter-bar" aria-label="Filter repositories">
      {isAdmin && (
        <>
          <fieldset className="repo-filter__group" style={fieldsetStyle} aria-label="Visibility">
            <span className="repo-filter__label">Visibility</span>
            <FilterChip label="Public" pressed={filters.visibility.has('public')} onClick={() => onToggleVisibility('public')} />
            <FilterChip label="Private" pressed={filters.visibility.has('private')} onClick={() => onToggleVisibility('private')} />
          </fieldset>
          <span className="repo-filter__divider" aria-hidden="true" />
        </>
      )}

      <fieldset className="repo-filter__group" style={fieldsetStyle} aria-label="CI Status">
        <span className="repo-filter__label">CI Status</span>
        <FilterChip label="Failing" tone="failing" pressed={filters.ciStatus.has('failing')} onClick={() => onToggleCiStatus('failing')} />
        <FilterChip label="Passing" tone="passing" pressed={filters.ciStatus.has('passing')} onClick={() => onToggleCiStatus('passing')} />
        <FilterChip label="No-CI" pressed={filters.ciStatus.has('no-ci')} onClick={() => onToggleCiStatus('no-ci')} />
      </fieldset>

      <span className="repo-filter__divider" aria-hidden="true" />
      <FilterChip label="Has PRs" pressed={filters.hasOpenPrs} onClick={onToggleHasOpenPrs} />
    </search>
  )
}

export const RepoFilterBar = memo(RepoFilterBarImpl)
