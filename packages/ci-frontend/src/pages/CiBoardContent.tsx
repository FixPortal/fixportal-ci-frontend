import { useState, useEffect, useMemo } from 'react'
import type { RepositorySnapshot } from '../api/types'
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot'
import { useCollapseState } from '../hooks/useCollapseState'
import { useHideNoCi } from '../hooks/useHideNoCi'
import { useCiAdmin } from '../CiAdminContext'
import { useCiConfig } from '../CiConfigContext'
import { isNoCi } from '../lib/isNoCi'
import { computeSummary } from '../lib/computeSummary'
import { SummaryStrip } from '../components/SummaryStrip'
import { RepoBoard } from '../components/RepoBoard'
import { RepoSection } from '../components/RepoSection'
import { LegendRow } from '../components/LegendRow'
import { PullRequestStepper } from '../components/PullRequestStepper'
import { flattenOpenPrs } from '../lib/flattenOpenPrs'
import { formatRelativeTime } from '../lib/relativeTime'
import { useRepoFilters } from '../hooks/useRepoFilters'
import { applyRepoFilters } from '../lib/applyRepoFilters'
import { RepoFilterBar } from '../components/RepoFilterBar'

// Apply the Hide No-CI toggle to a repo list. Shared by the pre-early-return
// openPrs computation and the post-guard visibleRepos so the filter shape lives
// in one place.
function applyNoCiFilter(repos: RepositorySnapshot[], hidden: boolean): RepositorySnapshot[] {
  return hidden ? repos.filter(r => !isNoCi(r)) : repos
}

const KEY_PUBLIC = 'section:public'
const KEY_PRIVATE = 'section:private'

function buildRepoList(
  visibleRepos: RepositorySnapshot[],
  publicRepos: RepositorySnapshot[],
  privateRepos: RepositorySnapshot[],
  showGroups: boolean,
  isNoCiHidden: boolean,
  noCiHidEverything: boolean,
  collapse: ReturnType<typeof useCollapseState>,
  filtersActive: boolean,
  onClearFilters: () => void,
) {
  if (visibleRepos.length === 0) {
    // Hide No-CI alone has emptied the board: clearing filters cannot restore
    // anything, so don't offer a "Clear filters" affordance that wouldn't help —
    // name the real cause (the toggle lives in the toolbar). Checked before the
    // filtersActive branch so the combined state isn't mislabelled.
    if (noCiHidEverything) {
      return <div className="state-msg">All repositories are No-CI — hidden.</div>
    }
    if (filtersActive) {
      return (
        <div className="state-msg">
          No repositories match the active filters.{' '}
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
  if (showGroups) {
    return (
      <>
        <RepoSection
          label="Public"
          count={publicRepos.length}
          collapsed={collapse.isCollapsed(KEY_PUBLIC)}
          onToggle={() => collapse.toggle(KEY_PUBLIC)}
        />
        {!collapse.isCollapsed(KEY_PUBLIC) &&
          publicRepos.map(repository => (
            <RepoBoard
              key={repository.name}
              repository={repository}
              collapsed={collapse.isCollapsed(repository.name)}
              onToggle={collapse.toggle}
            />
          ))
        }
        <RepoSection
          label="Private"
          count={privateRepos.length}
          collapsed={collapse.isCollapsed(KEY_PRIVATE)}
          onToggle={() => collapse.toggle(KEY_PRIVATE)}
        />
        {!collapse.isCollapsed(KEY_PRIVATE) &&
          privateRepos.map(repository => (
            <RepoBoard
              key={repository.name}
              repository={repository}
              collapsed={collapse.isCollapsed(repository.name)}
              onToggle={collapse.toggle}
            />
          ))
        }
      </>
    )
  }
  return visibleRepos.map(repository => (
    <RepoBoard
      key={repository.name}
      repository={repository}
      collapsed={collapse.isCollapsed(repository.name)}
      onToggle={collapse.toggle}
    />
  ))
}

export function CiBoardContent() {
  const snapshot = useDashboardSnapshot()
  const collapse = useCollapseState()
  const hideNoCi = useHideNoCi()
  const filters = useRepoFilters()
  const isAdmin = useCiAdmin()
  const { adminSnapshotUrl, adminSnapshotFetcher } = useCiConfig()
  const hasAdminSource = Boolean(adminSnapshotUrl || adminSnapshotFetcher)
  const [stepperOpen, setStepperOpen] = useState(false)

  // Memos must precede early returns (Rules of Hooks). snapshot.data is the stable
  // dep — React Query structural sharing keeps it reference-equal across no-change
  // poll ticks, so these only recompute when data actually changes.
  const repositories = useMemo(() => {
    const repos = snapshot.data?.repositories ?? []
    return isAdmin ? repos : repos.filter(r => !r.private)
  }, [isAdmin, snapshot.data])
  const noCiFiltered = useMemo(
    () => applyNoCiFilter(repositories, hideNoCi.hidden),
    [repositories, hideNoCi.hidden],
  )
  const visibleRepos = useMemo(
    () => applyRepoFilters(noCiFiltered, filters.filters),
    [noCiFiltered, filters.filters],
  )
  const summary = useMemo(() => {
    if (isAdmin && !hideNoCi.hidden && !filters.isActive) return snapshot.data?.summary ?? []
    return computeSummary(visibleRepos)
  }, [isAdmin, hideNoCi.hidden, filters.isActive, snapshot.data, visibleRepos])
  const lastMergedPr = useMemo(() => {
    const raw = snapshot.data?.lastMergedPr ?? null
    return raw && visibleRepos.some(r => r.name === raw.repo) ? raw : null
  }, [snapshot.data, visibleRepos])

  // Computed before the early returns so nextPr and the stepper guard are
  // available regardless of snapshot state.
  const openPrs = flattenOpenPrs(visibleRepos)

  useEffect(() => {
    if (openPrs.length === 0 && stepperOpen) {
      const id = setTimeout(() => setStepperOpen(false), 0)
      return () => clearTimeout(id)
    }
    return undefined
  }, [openPrs.length, stepperOpen])

  if (snapshot.isPending) {
    return (
      <main className="dashboard-page">
        <div className="state-msg">Loading dashboard…</div>
      </main>
    )
  }

  if (snapshot.isError) {
    return (
      <main className="dashboard-page">
        <div className="state-msg state-msg--error">Dashboard unavailable.</div>
      </main>
    )
  }

  // 204 -> null: backend is up but has not produced a snapshot yet.
  if (!snapshot.data) {
    return (
      <main className="dashboard-page">
        <div className="state-msg">Waiting for the first refresh…</div>
      </main>
    )
  }

  const { refreshedAt } = snapshot.data
  // Non-admin viewers see only public repos; admin sees all. repositories and
  // visibleRepos are memoized above the early returns (hooks must not follow returns).
  // Compute the names list and the all-collapsed flag once — they were rebuilt
  // and re-traversed twice per render (the onClick and the button label).
  const noCiCount = repositories.filter(isNoCi).length
  const repoNames = visibleRepos.map(r => r.name)
  const hiddenCount = repositories.length - noCiFiltered.length
  const publicRepos = visibleRepos.filter(r => !r.private)
  const privateRepos = visibleRepos.filter(r => r.private)
  const showGroups = publicRepos.length > 0 && privateRepos.length > 0
  const sectionKeys = showGroups ? [KEY_PUBLIC, KEY_PRIVATE] : []
  const allCollapsibleKeys = [...repoNames, ...sectionKeys]
  const allCollapsed = collapse.allCollapsed(allCollapsibleKeys)
  // The stepper opens at the head of this oldest-first list, so its first entry
  // is "next in queue" — derive it from visibleRepos (the Hide No-CI filter
  // applied) so the card and stepper never advertise a PR from a repo the board
  // is currently hiding. openPrs is computed above before the early returns.
  const nextPr = openPrs[0] ?? null

  // Hide No-CI removed every repo on its own (independent of the filter bar) —
  // drives the empty-state copy so "Clear filters" isn't offered when it can't help.
  const noCiHidEverything = hideNoCi.hidden && noCiFiltered.length === 0
  const repoListContent = buildRepoList(
    visibleRepos, publicRepos, privateRepos, showGroups, hideNoCi.hidden, noCiHidEverything, collapse,
    filters.isActive, filters.clear,
  )

  return (
    <main className="dashboard-page" tabIndex={-1}>
      <div className="dashboard__sticky">
      <div className="dashboard__toolbar">
        <span className="dashboard__scope">{snapshot.data.org} · {isAdmin && hasAdminSource ? 'all repositories' : 'public repositories'}</span>
        <span className="dashboard__toolbar-right">
          {noCiCount > 0 && (
            <button
              type="button"
              className={`dashboard__hide-noci${hideNoCi.hidden ? ' dashboard__hide-noci--on' : ''}`}
              onClick={hideNoCi.toggle}
              aria-pressed={hideNoCi.hidden}
            >
              {hideNoCi.hidden ? `Show No-CI · ${hiddenCount} hidden` : 'Hide No-CI'}
            </button>
          )}
          <button
            type="button"
            className="dashboard__collapse-all"
            onClick={() => (allCollapsed ? collapse.expandAll() : collapse.collapseAll(allCollapsibleKeys))}
          >
            {allCollapsed ? '⊞ Expand all' : '⊟ Collapse all'}
          </button>
          <span className="dashboard__refreshed">
            <span className="live-dot" aria-hidden="true" />
            updated {formatRelativeTime(refreshedAt)}
          </span>
        </span>
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
        summary={summary}
        onOpenPrs={isAdmin ? () => setStepperOpen(true) : undefined}
        lastMerged={lastMergedPr}
        nextPr={nextPr}
        ciTrend={snapshot.data.ciTrend ?? []}
      />
      <LegendRow />
      </div>
      <div className="repo-list">
        {repoListContent}
      </div>
      {stepperOpen && openPrs.length > 0 && (
        <PullRequestStepper prs={openPrs} onClose={() => setStepperOpen(false)} />
      )}
    </main>
  )
}
