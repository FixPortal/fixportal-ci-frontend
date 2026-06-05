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
}

export interface WorkflowSnapshot {
  name: string
  file: string
  state: SignalState
  lastRun: WorkflowRun | null
}

export interface PullRequest {
  number: number
  title: string
  author: string
  htmlUrl: string
  isDraft: boolean
  createdAt: string
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
  deploys: JobSignal[]
  packages: JobSignal[]
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
}

export interface DashboardSnapshot {
  refreshedAt: string
  org: string
  repositories: RepositorySnapshot[]
  summary: SummaryCount[]
  lastMergedPr: MergedPr | null
  ciTrend?: CiTrendBucket[]
}
