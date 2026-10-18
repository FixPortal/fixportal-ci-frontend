import { describe, expect, it } from 'vitest'
import type { RepositorySnapshot, WorkflowRun } from '../api/types'
import { failedRunsInBucket } from './failedRunsInBucket'

const run = (conclusion: string, updatedAt: string, htmlUrl: string): WorkflowRun => ({
  status: 'completed',
  title: 't',
  runNumber: 1,
  branch: 'main',
  event: 'push',
  conclusion,
  htmlUrl,
  updatedAt,
})

const repos = [
  {
    name: 'repo-a',
    workflows: [
      {
        name: 'CI',
        file: 'ci.yml',
        state: 'failure',
        lastRun: run('failure', '2026-10-18T10:30:00Z', 'https://x/1'),
        recentRuns: [
          run('failure', '2026-10-18T10:30:00Z', 'https://x/1'),
          run('success', '2026-10-18T10:40:00Z', 'https://x/2'),
          run('failure', '2026-10-18T11:00:00Z', 'https://x/3'),
        ],
      },
    ],
  },
] as unknown as RepositorySnapshot[]

describe('failedRunsInBucket', () => {
  it('returns deduped failures inside the hour only', () => {
    const found = failedRunsInBucket(repos, '2026-10-18T10:00:00Z')
    expect(found.map((f) => f.run.htmlUrl)).toEqual(['https://x/1'])
    expect(found[0]).toMatchObject({ repo: 'repo-a', workflow: 'CI' })
  })

  it('returns nothing for an unparseable bucket', () => {
    expect(failedRunsInBucket(repos, 'nope')).toEqual([])
  })
})
