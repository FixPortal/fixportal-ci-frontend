import { createRoot } from 'react-dom/client'
import { CiBoard, DefaultFooter, DEFAULT_CI_API_BASE } from '@fix-portal/ci-frontend'
import type {
  CiBoardProps,
  CiConfig,
  CiTrendBucket,
  CiTrendState,
  DashboardSnapshot,
  JobSignal,
  MergedPr,
  PullRequest,
  RepoMetrics,
  RepositorySnapshot,
  ReviewSignal,
  ReviewSignalState,
  SignalState,
  SummaryCount,
  WorkflowRun,
  WorkflowSnapshot,
} from '@fix-portal/ci-frontend'
import '@fix-portal/ci-frontend/board.css'
import '@fix-portal/ci-frontend/tokens.css'

type PublicTypes = [
  CiBoardProps,
  CiConfig,
  CiTrendBucket,
  CiTrendState,
  DashboardSnapshot,
  JobSignal,
  MergedPr,
  PullRequest,
  RepoMetrics,
  RepositorySnapshot,
  ReviewSignal,
  ReviewSignalState,
  SignalState,
  SummaryCount,
  WorkflowRun,
  WorkflowSnapshot,
]

const props: PublicTypes[0] = { adminSignal: false, apiBase: DEFAULT_CI_API_BASE, footerSlot: <DefaultFooter /> }

createRoot(document.createElement('div')).render(<CiBoard {...props} />)
