import { useState } from 'react'
import type { RepositorySnapshot, MergedPr, SummaryCount } from '../api/types'
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot'
import { useCollapseState } from '../hooks/useCollapseState'
import { useHideNoCi } from '../hooks/useHideNoCi'
import { useCiAdmin } from '../CiAdminContext'
import { isNoCi } from '../lib/isNoCi'
import { computeSummary } from '../lib/computeSummary'
import { SummaryStrip } from '../components/SummaryStrip'
import { RepoBoard } from '../components/RepoBoard'
import { RepoSection } from '../components/RepoSection'
import { MetricsLegend } from '../components/MetricsLegend'
import { StatusLegend } from '../components/StatusLegend'
import { PullRequestStepper } from '../components/PullRequestStepper'
import { flattenOpenPrs } from '../lib/flattenOpenPrs'
import { formatRelativeTime } from '../lib/relativeTime'

function getVisibleLastMergedPr(rawLastMerged: MergedPr | null, visibleRepos: RepositorySnapshot[]): MergedPr | null {
  if (!rawLastMerged) return null
  return visibleRepos.some(r => r.name === rawLastMerged.repo) ? rawLastMerged : null
}

function resolveSummary(isAdmin: boolean, hideNoCiHidden: boolean, adminSummary: SummaryCount[], visibleRepos: RepositorySnapshot[]): SummaryCount[] {
  return isAdmin && !hideNoCiHidden ? adminSummary : computeSummary(visibleRepos)
}

const KEY_PUBLIC = 'section:public'
const KEY_PRIVATE = 'section:private'

function buildRepoList(
  visibleRepos: RepositorySnapshot[],
  publicRepos: RepositorySnapshot[],
  privateRepos: RepositorySnapshot[],
  showGroups: boolean,
  hideNoCiHidden: boolean,
  collapse: ReturnType<typeof useCollapseState>,
) {
  if (visibleRepos.length === 0 && hideNoCiHidden) {
    return <div className="state-msg">All repositories are No-CI — hidden.</div>
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
  const isAdmin = useCiAdmin()
  const [stepperOpen, setStepperOpen] = useState(false)

  // Computed before the early returns so nextPr and the stepper guard are
  // available regardless of snapshot state. Defaults to [] when data is absent.
  const earlyRepos = snapshot.data?.repositories ?? []
  const earlyFiltered = isAdmin ? earlyRepos : earlyRepos.filter(r => !r.private)
  const openPrs = flattenOpenPrs(hideNoCi.hidden ? earlyFiltered.filter(r => !isNoCi(r)) : earlyFiltered)

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

  const { refreshedAt, repositories: allRepositories, lastMergedPr: rawLastMerged } = snapshot.data
  // Non-admin viewers see only public repos; admin sees all. Filtering here drives
  // everything downstream — summary counts, stepper PRs, and next-in-queue all
  // reflect exactly the repos displayed on screen.
  const repositories = isAdmin ? allRepositories : allRepositories.filter(r => !r.private)
  // Compute the names list and the all-collapsed flag once — they were rebuilt
  // and re-traversed twice per render (the onClick and the button label).
  const noCiCount = repositories.filter(isNoCi).length
  const visibleRepos = hideNoCi.hidden ? repositories.filter(r => !isNoCi(r)) : repositories
  const summary = resolveSummary(isAdmin, hideNoCi.hidden, snapshot.data.summary, visibleRepos)
  const lastMergedPr = getVisibleLastMergedPr(rawLastMerged, visibleRepos)
  const repoNames = visibleRepos.map(r => r.name)
  const hiddenCount = repositories.length - visibleRepos.length
  const publicRepos = visibleRepos.filter(r => !r.private)
  const privateRepos = visibleRepos.filter(r => r.private)
  const showGroups = publicRepos.length > 0 && privateRepos.length > 0
  const sectionKeys = showGroups ? [KEY_PUBLIC, KEY_PRIVATE] : []
  const allCollapsed = collapse.allCollapsed([...repoNames, ...sectionKeys])
  // The stepper opens at the head of this oldest-first list, so its first entry
  // is "next in queue" — derive it from visibleRepos (the Hide No-CI filter
  // applied) so the card and stepper never advertise a PR from a repo the board
  // is currently hiding. openPrs is computed above before the early returns.
  const nextPr = openPrs[0] ?? null

  const repoListContent = buildRepoList(visibleRepos, publicRepos, privateRepos, showGroups, hideNoCi.hidden, collapse)

  return (
    <main className="dashboard-page">
      <div className="dashboard__toolbar">
        <span className="dashboard__scope">{snapshot.data.org} · {isAdmin ? 'all repositories' : 'public repositories'}</span>
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
            onClick={() => (allCollapsed ? collapse.expandAll() : collapse.collapseAll([...repoNames, ...sectionKeys]))}
          >
            {allCollapsed ? '⊞ Expand all' : '⊟ Collapse all'}
          </button>
          <span className="dashboard__refreshed">
            <span className="live-dot" aria-hidden="true" />
            updated {formatRelativeTime(refreshedAt)}
          </span>
        </span>
      </div>
      <SummaryStrip summary={summary} onOpenPrs={isAdmin ? () => setStepperOpen(true) : undefined} lastMerged={lastMergedPr} nextPr={nextPr} ciTrend={snapshot.data.ciTrend ?? []} />
      <div className="repo-list">
        {repoListContent}
      </div>
      <StatusLegend />
      <MetricsLegend />
      {stepperOpen && openPrs.length > 0 && (
        <PullRequestStepper prs={openPrs} onClose={() => setStepperOpen(false)} />
      )}
    </main>
  )
}
