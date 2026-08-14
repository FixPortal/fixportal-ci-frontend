# Test-audit Backlog Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close verified audit findings FF1–FF5, FF7, and FF8 across the CI backend/frontend boundary while retaining PR #104's FF6 closure.

**Architecture:** The backend first commits a complete endpoint-owned JSON fixture. The frontend then validates all successful snapshot responses at runtime, consumes that backend fixture in CI, and adds real package, container, admin-source, storage, and release-boundary checks. No runtime validation dependency or shared contract package is introduced.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, React Testing Library, Node 24 built-ins, Docker/nginx, GitHub Actions, .NET 10, xUnit v3, AwesomeAssertions, NodaTime.

## Global Constraints

- Work only in each repository's literal `.claude/worktrees/reviewer-passes` review worktree.
- Frontend branch is `reviewer-findings-batch13`; backend branch is `reviewer-findings-batch22` after the existing backend worktree is resolved.
- Never modify the primary checkout.
- One audit slice per commit; never push until that repository's branch is complete and its full local gate is green.
- Frontend adds no runtime dependency and does not export the parser publicly.
- Parsers accept unknown additional object properties but validate every declared property they understand.
- Runtime contract errors name the failing path and never include response payload contents.
- Test-only slices require a temporary break-and-revert demonstration; no mutation remains in the final diff.
- Backend merges before the frontend branch is pushed, so frontend CI reads a stable fixture from backend `main`.
- Dependency PR review rules do not apply; these are human-authored HIGH/NORMAL changes according to each repository's committed review policy.

---

### Task 0: Resolve the occupied backend review worktree

**Files:** None.

**Interfaces:**
- Consumes: backend worktree `D:\fix-portal\fixportal-ci-backend\.claude\worktrees\reviewer-passes`.
- Produces: an absent review worktree and no live review branch, ready for batch 22.

Current evidence: the worktree is clean on `reviewer-findings-batch1`, four commits ahead of `origin/main`, with no remote branch. Those commits are unrelated unpublished work and must not be overwritten or folded into this audit pass.

- [ ] **Step 1: Ask the user to finish or abandon the existing backend pass**

Do not mutate the backend worktree until the user explicitly chooses its disposition.

- [ ] **Step 2: Verify the prior pass is no longer live**

Run from the backend primary checkout:

```powershell
git fetch --prune origin
git worktree list --porcelain
git branch --all --format='%(refname:short)'
```

Expected: no active backend review pass. If the old worktree/branch was merged, apply the repository's rebase-merge fingerprint before cleanup; if it was abandoned, require the user's explicit authorization recorded in the conversation.

- [ ] **Step 3: Create backend batch 22**

```powershell
git worktree add -b reviewer-findings-batch22 'D:\fix-portal\fixportal-ci-backend\.claude\worktrees\reviewer-passes' origin/main
```

- [ ] **Step 4: Establish the backend baseline**

Run in the new backend worktree:

```powershell
dotnet restore FixPortal.Ci.Backend.slnx
dotnet build FixPortal.Ci.Backend.slnx --configuration Release --no-restore
dotnet test FixPortal.Ci.Backend.slnx --configuration Release --no-build
```

Expected: clean build and all tests pass before the fixture slice begins.

---

### Task 1: FF8 backend-owned dashboard snapshot fixture

**Files:**
- Create: `D:\fix-portal\fixportal-ci-backend\.claude\worktrees\reviewer-passes\contracts\dashboard-snapshot.v1.json`
- Create: `D:\fix-portal\fixportal-ci-backend\.claude\worktrees\reviewer-passes\tests\FixPortal.Ci.Backend.Api.Tests\Dashboard\DashboardSnapshotContractFixtureTests.cs`
- Modify: `D:\fix-portal\fixportal-ci-backend\.claude\worktrees\reviewer-passes\tests\FixPortal.Ci.Backend.Api.Tests\FixPortal.Ci.Backend.Api.Tests.csproj`

**Interfaces:**
- Consumes: `DashboardSnapshot`, real HTTP JSON options, and `/api/dashboard/snapshot`.
- Produces: `contracts/dashboard-snapshot.v1.json`, the backend-owned FF8 input consumed by frontend CI.

- [ ] **Step 1: Add the complete fixture as copied test content**

Add this item to the test project:

```xml
<None Include="..\..\contracts\dashboard-snapshot.v1.json"
      Link="Contracts\dashboard-snapshot.v1.json"
      CopyToOutputDirectory="PreserveNewest" />
```

The fixture must contain one fully populated public repository and every current serialized member: workflow/recent runs/provider metadata, pull request review signals and ready-to-merge, metrics, deploy/package jobs, repository/global merged PRs, summary, `ciTrend`, and `publicCiTrend`. Use literal stable 2026 instants and camel-case enum strings.

- [ ] **Step 2: Add the real endpoint structural comparison**

Create an xUnit v3 integration test using `WebApplicationFactory<Program>`. Seed a complete `DashboardSnapshot`, request `/api/dashboard/snapshot`, parse both bodies as `JsonNode`, and assert:

```csharp
_ = response.StatusCode.Should().Be(HttpStatusCode.OK);
var actual = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
var expected = JsonNode.Parse(await File.ReadAllTextAsync(
    Path.Combine(AppContext.BaseDirectory, "Contracts", "dashboard-snapshot.v1.json"),
    TestContext.Current.CancellationToken
));
_ = JsonNode.DeepEquals(actual, expected).Should().BeTrue();
```

Keep the real application JSON configuration and endpoint. Replace hosted services and seed only `DashboardSnapshotState`, matching the existing `ReviewSignalEndpointTests` pattern.

- [ ] **Step 3: Demonstrate the new check can fail**

Temporarily add `[property: JsonIgnore]` to `DashboardSnapshot.PublicCiTrend`, run:

```powershell
dotnet test tests/FixPortal.Ci.Backend.Api.Tests/FixPortal.Ci.Backend.Api.Tests.csproj --filter FullyQualifiedName~DashboardSnapshotContractFixtureTests
```

Expected: FAIL because `publicCiTrend` is missing. Revert only the temporary attribute and rerun; expected PASS. Confirm `DashboardModels.cs` has no diff.

- [ ] **Step 4: Run the focused and full backend gate**

```powershell
dotnet csharpier check .
dotnet build FixPortal.Ci.Backend.slnx --configuration Release
dotnet test FixPortal.Ci.Backend.slnx --configuration Release --no-build
```

- [ ] **Step 5: Commit the backend slice**

```powershell
git add contracts/dashboard-snapshot.v1.json tests/FixPortal.Ci.Backend.Api.Tests/Dashboard/DashboardSnapshotContractFixtureTests.cs tests/FixPortal.Ci.Backend.Api.Tests/FixPortal.Ci.Backend.Api.Tests.csproj
git commit -m "test(contract): lock dashboard snapshot fixture"
```

Push once, open the backend PR, request the required reviewers, and merge it before Task 2. Pull backend `main` with `git pull --ff-only` after the rebase merge.

---

### Task 2: FF1 runtime dashboard snapshot validation

**Files:**
- Create: `packages/ci-frontend/src/api/parseDashboardSnapshot.ts`
- Create: `packages/ci-frontend/src/api/parseDashboardSnapshot.test.ts`
- Modify: `packages/ci-frontend/src/api/getDashboardSnapshot.ts`
- Modify: `packages/ci-frontend/src/api/getDashboardSnapshot.test.ts`

**Interfaces:**
- Consumes: unknown JSON returned by `Response.json()` and declarations in `api/types.ts`.
- Produces: `parseDashboardSnapshot(value: unknown): DashboardSnapshot`, internal to the package.

- [ ] **Step 1: Write failing fetch-boundary tests**

Add table-driven cases with literal bodies:

```typescript
test.each([
  [{ org: 'FixPortal', refreshedAt: '2026-08-14T00:00:00Z', summary: [], lastMergedPr: null }, '$.repositories'],
  [{ org: 'FixPortal', refreshedAt: '2026-08-14T00:00:00Z', repositories: [{ name: 'repo' }], summary: [], lastMergedPr: null }, '$.repositories[0].htmlUrl'],
  [{ org: 'FixPortal', refreshedAt: '2026-08-14T00:00:00Z', repositories: [], summary: [{ key: 'passing', count: '1' }], lastMergedPr: null }, '$.summary[0].count'],
])('rejects incompatible successful JSON at %s', async (body, path) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)))
  await expect(getDashboardSnapshot(URL)).rejects.toThrow(`Invalid dashboard snapshot at ${path}`)
})
```

Run the focused test. Expected: FAIL because successful JSON is returned unchecked.

- [ ] **Step 2: Implement the minimum parser helpers**

Use boring internal helpers with path-aware failures:

```typescript
type JsonObject = Record<string, unknown>

function invalid(path: string, expected: string): never {
  throw new Error(`Invalid dashboard snapshot at ${path}: expected ${expected}`)
}

function objectAt(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(path, 'object')
  return value as JsonObject
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') invalid(path, 'string')
  return value
}

function numberAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'finite number')
  return value
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path, 'boolean')
  return value
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, 'array')
  return value
}
```

Add `nullable`, `optional`, and literal-enum helpers, then one validator per declared interface. Validate every member in `DashboardSnapshot`, `RepositorySnapshot`, `WorkflowSnapshot`, `WorkflowRun`, `PullRequest`, `ReviewSignal`, `RepoMetrics`, `JobSignal`, `SummaryCount`, `MergedPr`, and `CiTrendBucket`. Do not reject unknown keys. Return the original object only after every validator succeeds:

```typescript
export function parseDashboardSnapshot(value: unknown): DashboardSnapshot {
  validateDashboardSnapshot(value, '$')
  return value as DashboardSnapshot
}
```

Call it after `await response.json()` in `getDashboardSnapshot`.

- [ ] **Step 3: Cover a complete valid shape and payload secrecy**

Add a fully populated literal valid fixture, including null/optional branches, and assert it is returned. Add a malformed body containing `secret-marker` and assert the thrown message contains the property path but not `secret-marker`.

- [ ] **Step 4: Verify RED to GREEN**

```powershell
npm run test -w @fix-portal/ci-frontend -- src/api/getDashboardSnapshot.test.ts src/api/parseDashboardSnapshot.test.ts
npm run typecheck -w @fix-portal/ci-frontend
```

Expected: focused tests and typecheck pass.

- [ ] **Step 5: Commit FF1**

```powershell
git add packages/ci-frontend/src/api/getDashboardSnapshot.ts packages/ci-frontend/src/api/getDashboardSnapshot.test.ts packages/ci-frontend/src/api/parseDashboardSnapshot.ts packages/ci-frontend/src/api/parseDashboardSnapshot.test.ts
git commit -m "fix(api): validate dashboard snapshots"
```

---

### Task 3: FF2 storage-denied guest startup

**Files:**
- Modify: `apps/dashboard/src/readAdminSignal.test.ts`
- Modify: `apps/dashboard/src/readAdminSignal.ts`

**Interfaces:**
- Consumes: query-string admin signal and browser `localStorage`.
- Produces: a boolean admin presentation signal that fails closed.

- [ ] **Step 1: Write failing read/write denial tests**

Use spies on the real storage prototype:

```typescript
it.each(['getItem', 'setItem'] as const)('fails closed when localStorage.%s throws', method => {
  const spy = vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  if (method === 'setItem') setSearch('?admin=true')
  expect(readAdminSignal()).toBe(false)
  spy.mockRestore()
})
```

Run the dashboard test. Expected: FAIL with the thrown `SecurityError`.

- [ ] **Step 2: Add one fail-closed boundary**

Wrap the existing set/get sequence in one `try/catch` and return `false` from the catch. Do not add logging or a storage abstraction.

- [ ] **Step 3: Verify and commit FF2**

```powershell
npm run test -w dashboard
git add apps/dashboard/src/readAdminSignal.ts apps/dashboard/src/readAdminSignal.test.ts
git commit -m "fix(dashboard): fail closed when storage is unavailable"
```

---

### Task 4: FF7 admin source precedence and cache isolation

**Files:**
- Modify: `packages/ci-frontend/src/hooks/useDashboardSnapshot.test.tsx`

**Interfaces:**
- Consumes: existing `adminSnapshotFetcher`, `adminSnapshotUrl`, and `adminSnapshotCacheKey` behavior.
- Produces: demonstrated regression protection; no production deliverable.

- [ ] **Step 1: Add precedence coverage**

Mount an admin hook with both sources. Make the custom fetcher return `snapshotFor('fetcher')`, stub global fetch to return `snapshotFor('url')`, wait for data, then assert the real hook returns `fetcher` and the URL fetch was never called.

- [ ] **Step 2: Add two-board admin isolation coverage**

Under one real `QueryClient`, mount two admin hooks with distinct fetchers and `adminSnapshotCacheKey` values. Assert each result retains its own organization value.

- [ ] **Step 3: Demonstrate both checks can fail**

Temporarily put the `adminSnapshotUrl` branch before `adminSnapshotFetcher`; the precedence test must fail. Revert. Temporarily remove `adminSnapshotCacheKey` from the admin fetcher query key; the isolation test must fail. Revert and confirm `useDashboardSnapshot.ts` has no diff.

- [ ] **Step 4: Verify and commit FF7**

```powershell
npm run test -w @fix-portal/ci-frontend -- src/hooks/useDashboardSnapshot.test.tsx
git add packages/ci-frontend/src/hooks/useDashboardSnapshot.test.tsx
git commit -m "test(snapshot): cover admin source isolation"
```

---

### Task 5: FF5 isolated packed-consumer contract

**Files:**
- Create: `test/package-consumer/package.json`
- Create: `test/package-consumer/tsconfig.json`
- Create: `test/package-consumer/index.tsx`
- Create: `test/package-consumer/vite.config.ts`
- Create: `scripts/package-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the tarball emitted by `npm pack -w @fix-portal/ci-frontend`.
- Produces: `npm run test:package`, an isolated install/typecheck/build check.

- [ ] **Step 1: Add the minimal consumer**

The consumer imports `CiBoard`, a representative exported type, `@fix-portal/ci-frontend/board.css`, and `@fix-portal/ci-frontend/tokens.css`, then renders through React. Its package uses exact current peer/build majors and contains `typecheck` and `build` scripts.

- [ ] **Step 2: Add the Node orchestration**

Use only `node:child_process`, `node:fs/promises`, `node:os`, and `node:path`:

```javascript
const root = process.cwd()
const temp = await mkdtemp(join(tmpdir(), 'ci-frontend-consumer-'))
try {
  execFileSync('npm', ['run', 'build:lib'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  execFileSync('npm', ['pack', '-w', '@fix-portal/ci-frontend', '--pack-destination', temp], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  // Copy the persistent consumer, replace its package dependency with file:<tarball>, install, typecheck, build.
} finally {
  await rm(temp, { recursive: true, force: true })
}
```

Add `"test:package": "node scripts/package-smoke.mjs"` at the root.

- [ ] **Step 3: Run the real contract and demonstrate failure**

Run `npm run test:package`; expected PASS. Temporarily remove `./tokens.css` from package exports, rebuild, and rerun; expected FAIL during consumer resolution/build. Revert the package mutation and rerun PASS.

- [ ] **Step 4: Commit FF5**

```powershell
git add package.json scripts/package-smoke.mjs test/package-consumer
git commit -m "test(package): verify packed consumer contract"
```

---

### Task 6: FF3 production nginx container smoke

**Files:**
- Create: `scripts/container-smoke.mjs`
- Modify: `docker-entrypoint.sh`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `Dockerfile`, `docker-entrypoint.sh`, and `nginx.conf.template`.
- Produces: `npm run test:container` and a merge-gating `container-smoke` CI job.

- [ ] **Step 1: Add a bounded real-container harness**

Use a Node host HTTP server on an ephemeral port and `docker build`/`docker run` through `execFile`/`spawn`. Run the image with `--add-host host.docker.internal:host-gateway`, a random published port, and `BACKEND_URL=http://host.docker.internal:<upstreamPort>`. Poll `/` to a fixed diagnostic deadline, then assert:

```text
/nested/route -> 200 and the built SPA entry point
/api/probe?value=1 -> upstream receives /api/probe?value=1
upstream Host -> host.docker.internal:<upstreamPort>
X-Forwarded-For -> present
```

Always remove the named container and close the upstream server in `finally`.

- [ ] **Step 2: Validate `BACKEND_URL` before envsubst**

Accept only `http://host[:port]` or `https://host[:port]` with no path, query, fragment, credentials, or trailing slash. Keep the POSIX shell implementation short using a `case` plus a second path check; print one stable error and exit non-zero.

```sh
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
esac
backend_authority=${BACKEND_URL#*://}
case "$backend_authority" in
  ''|*/*|*\?*|*\#*|*@*) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
esac
```

- [ ] **Step 3: Cover invalid startup**

The harness runs the image with missing and invalid values (`https://backend/`, `https://backend/path`, `ftp://backend`) and asserts non-zero exit plus the stable error.

- [ ] **Step 4: Demonstrate the proxy regression check**

Run `npm run test:container`; expected PASS. Temporarily change `proxy_pass ${BACKEND_URL};` to `proxy_pass ${BACKEND_URL}/;`; rerun and expect the upstream-path assertion to FAIL. Revert and rerun PASS.

- [ ] **Step 5: Gate pull requests**

Add a `container-smoke` job to `ci.yml`, include it in `ci-gate.needs`, and remove `docker` from the only quality path by keeping `docker` explicitly exempt as the post-merge publisher. Run the existing gate assertion with `GATE_EXEMPT=docker` and expect all jobs accounted for.

- [ ] **Step 6: Commit FF3**

```powershell
git add scripts/container-smoke.mjs docker-entrypoint.sh package.json .github/workflows/ci.yml
git commit -m "test(container): exercise production nginx runtime"
```

---

### Task 7: FF4 release identity and complete quality gate

**Files:**
- Create: `scripts/release-tag.mjs`
- Create: `scripts/release-tag.test.mjs`
- Create: `.github/scripts/assert_release_gate.py`
- Create: `.github/scripts/test_assert_release_gate.py`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `GITHUB_REF_NAME`, package version, and the release workflow graph.
- Produces: tested tag equality plus a publish step structurally dominated by the complete gate.

- [ ] **Step 1: Write RED tag tests with Node's built-in runner**

Export `assertReleaseTag(tag, version)` and cover `v2.6.1`, `v2.6.0`, `2.6.1`, `v2.6.1-beta`, and empty input. Mismatch errors include expected and actual tags. Run `node --test scripts/release-tag.test.mjs`; expected FAIL because the module does not exist.

- [ ] **Step 2: Implement the one comparison**

```javascript
export function assertReleaseTag(tag, version) {
  const expected = `v${version}`
  if (tag !== expected) throw new Error(`Release tag mismatch: expected ${expected}, received ${tag || '<empty>'}`)
}
```

When run as the main module, read `packages/ci-frontend/package.json`, check `process.env.GITHUB_REF_NAME`, and exit non-zero on failure.

- [ ] **Step 3: Add a behavioral workflow policy test**

`assert_release_gate.py` parses YAML and verifies that the publish job's ordered steps contain the named release commands before `npm publish`: tag check, audit, lint, all workspace tests, typecheck, coverage, both builds, Playwright, package smoke, and container smoke. Its unit test feeds a valid minimal workflow plus negative fixtures with a missing command and publish moved before verification; assert non-zero decisions from the real policy function.

- [ ] **Step 4: Share repository-local verification commands**

Add root scripts:

```json
"test:scripts": "node --test scripts/*.test.mjs",
"verify": "npm audit --omit=dev --audit-level=high && npm run lint && npm run test && npm run test:scripts && npm run typecheck -w @fix-portal/ci-frontend && npm run coverage -w @fix-portal/ci-frontend && npm run build:lib && npm run build:app"
```

Keep container/package/Playwright commands separate because they have distinct setup and runtime requirements.

- [ ] **Step 5: Make release execute the full gate before publish**

After install, run tag check, `npm run verify`, install Chromium, run Playwright, package smoke, and container smoke. Keep `npm publish --provenance -w @fix-portal/ci-frontend` last. CI also runs `test:scripts`, Playwright, package smoke, and the release-policy test so the release-only decision logic is itself merge-gated.

- [ ] **Step 6: Verify and commit FF4**

```powershell
node --test scripts/release-tag.test.mjs
python .github/scripts/test_assert_release_gate.py
python .github/scripts/assert_release_gate.py .github/workflows/release.yml
git add scripts/release-tag.mjs scripts/release-tag.test.mjs .github/scripts/assert_release_gate.py .github/scripts/test_assert_release_gate.py package.json .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "ci(release): gate publication on version and full verification"
```

---

### Task 8: FF8 frontend validation of the backend-owned fixture

**Files:**
- Create: `packages/ci-frontend/src/api/backendContract.contract.ts`
- Create: `packages/ci-frontend/vitest.backend-contract.config.ts`
- Create: `scripts/backend-contract.mjs`
- Modify: `packages/ci-frontend/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: backend `contracts/dashboard-snapshot.v1.json` and the internal parser from Task 2.
- Produces: `npm run test:backend-contract -- <fixture-path>`.

- [ ] **Step 1: Add an explicit fixture-path contract test**

Read `process.env.BACKEND_SNAPSHOT_FIXTURE`. Absence is an error, not a skip. Parse the file as unknown JSON, call `parseDashboardSnapshot`, and assert representative optional branches survive (`reviewSignals`, `readyToMerge`, `publicCiTrend`). Name the file `backendContract.contract.ts`, so the default `*.test.ts` discovery never selects it.

Add `vitest.backend-contract.config.ts` with Node environment and an exact include for that file. Add the package script `"test:backend-contract": "vitest run --config vitest.backend-contract.config.ts"`.

- [ ] **Step 2: Add the dedicated command**

Create `scripts/backend-contract.mjs`. Require exactly one fixture argument, resolve it, set `BACKEND_SNAPSHOT_FIXTURE`, and run the existing workspace Vitest command with `spawnSync` and inherited stdio. Exit with the child's status. Do not add `cross-env`.

```javascript
const fixture = process.argv[2]
if (!fixture) throw new Error('usage: npm run test:backend-contract -- <fixture-path>')
const result = spawnSync(
  'npm',
  ['run', 'test:backend-contract', '-w', '@fix-portal/ci-frontend'],
  {
    env: { ...process.env, BACKEND_SNAPSHOT_FIXTURE: resolve(fixture) },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)
process.exit(result.status ?? 1)
```

Add the root script `"test:backend-contract": "node scripts/backend-contract.mjs"`.

- [ ] **Step 3: Demonstrate fixture drift detection**

Run against the real backend fixture; expected PASS. Copy it to a temporary file, replace one nested `state` with `"cancelled"`, run again, and expect FAIL at the exact property path. Remove the temporary file.

- [ ] **Step 4: Wire the public backend checkout into frontend CI**

Add a second `actions/checkout` step with:

```yaml
- name: Check out backend contract
  uses: actions/checkout@v7
  with:
    repository: FixPortal/fixportal-ci-backend
    path: .contract/backend
    persist-credentials: false
```

Run the dedicated contract command against `.contract/backend/contracts/dashboard-snapshot.v1.json`. No token, backend build, or temporary branch ref is used.

- [ ] **Step 5: Commit FF8 frontend half**

```powershell
git add packages/ci-frontend/src/api/backendContract.contract.ts packages/ci-frontend/vitest.backend-contract.config.ts packages/ci-frontend/package.json scripts/backend-contract.mjs package.json .github/workflows/ci.yml
git commit -m "test(contract): verify backend-owned snapshot fixture"
```

---

### Task 9: Full frontend verification and single push

**Files:** All files changed by Tasks 2–8.

**Interfaces:**
- Consumes: every frontend audit slice.
- Produces: one finished frontend branch safe to push and review.

- [ ] **Step 1: Run the complete local gate**

```powershell
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:scripts
npm run typecheck -w @fix-portal/ci-frontend
npm run coverage -w @fix-portal/ci-frontend
npm run build:lib
npm run build:app
npm run test:e2e
npm run test:package
npm run test:container
npm run test:backend-contract -- 'D:\fix-portal\fixportal-ci-backend\contracts\dashboard-snapshot.v1.json'
python .github/scripts/assert_gate_coverage.py .github/workflows/ci.yml
python .github/scripts/assert_release_gate.py .github/workflows/release.yml
git diff --check origin/main...HEAD
```

Every command must exit zero. Record exact test counts and coverage percentages.

- [ ] **Step 2: Inspect the final branch**

```powershell
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: clean worktree; only the approved spec, plan, and FF slices.

- [ ] **Step 3: Push once and open the frontend PR**

Use the repository's finishing gate and PR sentinel from the review worktree, push `reviewer-findings-batch13` once, open the PR, and request reviewers according to `.claude/review-policy.json`. Do not request CodeRabbit unless the committed policy marks the diff HIGH.

---

### Task 10: Post-merge reconciliation and cleanup

**Files:**
- Create: `E:\Documents\Obsidian Vault\Claude\Test Audit\fixportal-ci-frontend\2026-08-<day>.md` using the next unused same-day suffix.

**Interfaces:**
- Consumes: both rebase-merged PRs and the 2026-08-06 verified audit report.
- Produces: durable delta reconciliation with FF1–FF8 resolution anchors.

- [ ] **Step 1: Synchronize both live primary checkouts**

For each repository, fetch/prune, switch to `main`, and `git pull --ff-only`. Verify the remote review branch is gone and commit titles match the rebase-merged main commits before force-deleting the local review branch.

- [ ] **Step 2: Remove both ephemeral review worktrees**

Change the shell to each verified primary checkout before `git worktree remove`. Remove the corresponding local reviewer branch only after the rebase fingerprint passes.

- [ ] **Step 3: Run audit-tests Delta reconciliation**

Use the 2026-08-06 report and audited commit `acd274af02d57a274387c2e4344afebb718ea6c8` as the semantic baseline. Verify each claimed Critical/High resolution independently. The report must name the merged frontend/backend SHAs and these concrete anchors:

```text
FF1 parser/fetch tests
FF2 denied-storage tests
FF3 container smoke
FF4 release tag and workflow policy tests
FF5 isolated packed consumer
FF6 root workspace test gate from PR #104
FF7 admin precedence/cache isolation tests
FF8 backend endpoint fixture plus frontend backend-contract test
```

- [ ] **Step 4: Report actual closure**

If every resolution is demonstrated, state that the 2026-08-06 backlog is closed. If any verifier refutes a resolution, retain that item in the new report and state it plainly; do not force a clean verdict ahead of tomorrow's full review.
