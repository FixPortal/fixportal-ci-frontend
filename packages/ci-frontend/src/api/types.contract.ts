import type { DashboardSnapshot } from './types'

// Compile-only nullability intent; runtime wire behavior is covered by backendContract.contract.ts.
const _contract = {
  refreshedAt: '2026-07-16T10:00:00Z',
  org: 'FixPortal',
  repositories: [
    {
      name: 'ci-frontend',
      htmlUrl: 'https://github.com/FixPortal/fixportal-ci-frontend',
      private: false,
      workflows: [
        {
          name: 'CI',
          file: 'ci.yml',
          state: 'success',
          lastRun: {
            status: 'completed',
            conclusion: 'success',
            htmlUrl: 'https://github.com/FixPortal/fixportal-ci-frontend/actions',
            title: 'Align snapshot contract',
            runNumber: 42,
            branch: 'main',
            event: 'push',
            updatedAt: '2026-07-16T10:00:00Z',
            repository: null,
            workflowFile: 'ci.yml',
            providerRunId: 42,
            runAttempt: 1,
            headSha: 'abc123',
          },
          recentRuns: [],
        },
      ],
      pullRequests: [],
      metrics: null,
      deploys: null,
      packages: null,
      lastMergedPr: null,
    },
  ],
  summary: [],
  lastMergedPr: null,
  ciTrend: null,
  publicCiTrend: [
    {
      bucketStart: '2026-07-16T09:00:00Z',
      state: 'passing',
      isBackfilled: true,
    },
  ],
} satisfies DashboardSnapshot

export type NullableWireContract = typeof _contract
