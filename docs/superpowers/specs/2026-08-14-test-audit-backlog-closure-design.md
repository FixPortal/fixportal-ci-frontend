# Test-audit Backlog Closure Design

## Goal

Close the verified FF1–FF8 backlog from the 2026-08-06 test-adequacy audit. FF6 is already closed by PR #104; this pass completes FF1–FF5, FF7, and FF8 without adding a runtime validation dependency or a shared contract package.

## Repositories and delivery order

The work spans two public repositories and two review branches/PRs.

1. `fixportal-ci-backend` lands a backend-owned complete dashboard snapshot fixture plus an endpoint serialization test.
2. `fixportal-ci-frontend` consumes that stable fixture from backend `main`, implements the remaining runtime and test boundaries, and completes its release gate.

Each repository uses its dedicated `.claude/worktrees/reviewer-passes` worktree and the next monotonic `reviewer-findings-batch<N>` branch. The backend PR must merge first so frontend CI never depends on a temporary branch ref.

## Frontend runtime boundary

Add an internal `parseDashboardSnapshot(value: unknown): DashboardSnapshot` parser beside the existing snapshot API types. It accepts unknown additional properties for forward compatibility, but validates every currently declared required and optional field, nested array/object shape, nullable member, and enum value before returning the typed value.

`getDashboardSnapshot` keeps its existing HTTP and `204` behavior. For a successful JSON response it passes the unknown value through the parser. Invalid input throws a stable error naming the failing property path but never includes the response payload. React Query already converts that rejection into the board's controlled error state.

The parser remains internal. It does not expand the published package API and does not require Zod, Ajv, or another runtime dependency.

## Dashboard startup boundary

`readAdminSignal` treats browser storage as untrusted infrastructure. A failed write or read returns `false`, so the standalone dashboard starts in guest mode rather than crashing. A successful explicit `?admin=true` or `?admin=false` keeps the current persistence behavior.

## Existing admin-fetcher behavior

No production change is expected. Tests demonstrate that `adminSnapshotFetcher` wins over `adminSnapshotUrl` and that two admin fetchers with distinct `adminSnapshotCacheKey` values keep separate rows in one real `QueryClient`. Temporary break-and-revert mutations prove each test detects the corresponding precedence or cache-alias regression.

## Published package contract

Add a persistent minimal consumer fixture and a Node orchestration script using built-in filesystem/process APIs. The smoke test:

1. runs `npm pack` for `@fix-portal/ci-frontend`;
2. installs the tarball and its peer/build dependencies into a fresh temporary directory;
3. imports representative runtime and type exports plus `board.css` and `tokens.css`;
4. typechecks and builds the isolated consumer; and
5. removes the temporary directory and tarball in a `finally` path.

The test never resolves the package through the workspace, so missing packed files or broken export metadata fail at the consumer boundary.

## Production container contract

Add a Node smoke harness using built-in HTTP and child-process APIs plus the repository's existing Docker requirement. It starts a tiny host upstream, builds and runs the production image with a valid bare-origin `BACKEND_URL`, and verifies:

- nginx starts with a valid rendered configuration;
- an arbitrary browser route receives the SPA entry point;
- `/api/` preserves its path and query string at the upstream;
- the upstream receives the intended `Host` and forwarding headers; and
- a missing or invalid backend origin fails clearly.

The harness uses bounded startup polling and always stops the container and upstream in `finally`. CI runs this on pull requests, rather than only building/publishing the image after merge.

## Release identity and quality gate

Add a small tested Node function that accepts only a tag exactly equal to `v<packages/ci-frontend package version>`. Mismatched and malformed tags fail before publication.

The release job then runs the same substantive gate as CI for the tagged SHA: workflow lint, dependency audit, source lint, every workspace test, library typecheck and coverage, both builds, isolated package smoke, and production container smoke. `npm publish` remains the final step and cannot run after a failed predecessor.

Shared npm scripts hold the repository-local commands so CI and release do not maintain divergent command lists. GitHub-specific setup remains in each workflow.

## Backend-owned contract fixture

The backend repository commits one complete JSON fixture produced from a representative `DashboardSnapshot` served through the real `/api/dashboard/snapshot` endpoint. It includes every current nested contract family and optional/nullable member, including review signals, ready-to-merge, recent runs, provider metadata, repository job lanes, merge data, and both trend fields.

A backend integration test requests that endpoint and compares its parsed JSON structurally with the committed fixture. Any serialization change requires an intentional fixture change in the same backend PR.

Frontend CI checks out backend `main` into a disposable path and runs the frontend parser contract test against that backend-owned fixture. This is the independent evidence missing from the self-authored TypeScript contract test. The checkout is public and credential-free; no backend build is required in the frontend job.

## Test strategy and closure evidence

Every slice leaves one runnable regression check and follows the repository's existing Vitest, React Testing Library, Playwright, Node, and Docker conventions.

- FF1: malformed top-level and representative nested successful JSON reject through the real parser/fetch boundary; a complete valid fixture succeeds.
- FF2: throwing storage reads and writes return guest without crashing.
- FF3: the production image serves SPA and proxy traffic correctly and rejects invalid startup configuration.
- FF4: valid, mismatched, and malformed tags exercise real release decision logic; workflow policy checks keep publication after the full gate.
- FF5: a tarball installed outside the workspace typechecks and builds all public subpaths.
- FF6: retain PR #104's root workspace test gate as the existing closure.
- FF7: real QueryClient tests cover admin precedence and cache isolation.
- FF8: backend endpoint serialization equals the backend-owned fixture, and frontend CI parses that exact fixture.

Behavior changes use normal red-green TDD. Test-only gaps are accepted only after temporarily breaking the defended production/configuration behavior, observing the new test fail for the expected reason, reverting the break, and observing it pass. No temporary mutation remains in either diff.

## Final verification and durable reconciliation

Before either push, run that repository's complete configured local gate. The frontend gate includes audit, lint, all tests, typecheck, coverage, both builds, package smoke, container smoke, Playwright, and gate-policy assertions. The backend gate includes CSharpier, restore, Release build, and the full test suite.

After both PRs merge, run a delta reconciliation against `E:\Documents\Obsidian Vault\Claude\Test Audit\fixportal-ci-frontend\2026-08-06.md`. Write a new additive vault report that names the merged SHAs and the concrete test anchor proving each FF item resolved. Tomorrow's full review remains a separate independent assessment.
