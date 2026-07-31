export type SignalState = 'success' | 'failure' | 'running' | 'unknown'

export interface WorkflowRun {
  status: string | null
  conclusion: string | null
  htmlUrl: string
  title: string
  runNumber: number
  branch: string | null
  event: string | null
  updatedAt: string
  repository?: string | null
  workflowFile?: string | null
}

export interface WorkflowSnapshot {
  name: string
  file: string
  state: SignalState
  lastRun: WorkflowRun | null
}

export type ReviewSignalState = 'clean' | 'outstanding' | 'pending' | 'disabled'

export interface ReviewSignal {
  name: string
  state: ReviewSignalState
  count?: number | null
  htmlUrl?: string | null
}

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

export interface RepoMetrics {
  nloc: number
  avgComplexity: number
  functionCount: number
  highComplexityCount: number
  computedAt: string
}

export interface JobSignal {
  workflow: string
  name: string
  state: SignalState
  htmlUrl: string
  updatedAt: string
}

export interface RepositorySnapshot {
  name: string
  htmlUrl: string
  private: boolean
  workflows: WorkflowSnapshot[]
  pullRequests: PullRequest[]
  metrics: RepoMetrics | null
  deploys: JobSignal[] | null
  packages: JobSignal[] | null
  lastMergedPr?: MergedPr | null
}

export interface SummaryCount {
  key: string
  count: number
}

export interface MergedPr {
  number: number
  title: string
  author: string
  repo: string
  htmlUrl: string
  mergedAt: string
}

export type CiTrendState = 'noData' | 'passing' | 'failing'

export interface CiTrendBucket {
  bucketStart: string
  state: CiTrendState
  isBackfilled?: boolean
}

export interface DashboardSnapshot {
  refreshedAt: string
  org: string
  repositories: RepositorySnapshot[]
  summary: SummaryCount[]
  lastMergedPr: MergedPr | null
  ciTrend?: CiTrendBucket[] | null
  publicCiTrend?: CiTrendBucket[] | null
}
