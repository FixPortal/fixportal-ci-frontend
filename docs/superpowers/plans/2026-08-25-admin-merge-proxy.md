# Authenticated CI Merge Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ready pull requests rebase-mergeable by signed-in PlatformAdmin users from `www.fixportal.org/ci` without exposing the CI admin key.

**Architecture:** Expose the component library's existing `mergeFetcher` seam, add one PlatformAdmin-only simulator proxy that injects `X-Admin-Key`, and supply that callback from the FixPortal host. Deliver in backend → package → consumer order so the UI is never deployed before its write endpoint.

**Tech Stack:** React 19, TypeScript 6, Vitest, TanStack Query, ASP.NET Core 10 minimal APIs, xUnit v3, AwesomeAssertions, GitHub Actions, npm, Azure Static Web Apps.

**Spec:** `docs/superpowers/specs/2026-08-25-admin-merge-proxy-design.md`

## Global Constraints

- `ci.fixportal.org` remains public and read-only.
- The browser must never receive or send `X-Admin-Key`.
- The CI backend remains authoritative for repository allow-listing, readiness, mergeability, and rebase-only policy.
- Reuse the existing `CiConfig.mergeFetcher`, simulator `api/ci` route group, `PlatformAdmin` policy, and frontend `post`/`ApiError` helpers.
- Add no dependencies, batch endpoint, queue, or second merge orchestration path.
- Use one final push per branch after the full local suite is green.

## File map

### `fixportal-simulator-backend`

- Modify `src/FixPortal.Simulator.WebApi/Endpoints/CiEndpoints.cs` — authenticated merge proxy.
- Modify `tests/FixPortal.Simulator.Tests/Integration/CiController_HttpTests.cs` — proxy/auth/validation regression coverage.
- Regenerate `contracts/rest/simulator.openapi.json` — committed REST contract.

### `fixportal-ci-frontend`

- Modify `packages/ci-frontend/src/CiBoard.tsx` — public `mergeFetcher` prop and context pass-through.
- Modify `packages/ci-frontend/src/CiBoard.test.tsx` — public component integration regression.
- Modify `README.md` and `packages/ci-frontend/README.md` — document the callback.
- Modify `packages/ci-frontend/CHANGELOG.md`, `packages/ci-frontend/package.json`, and `package-lock.json` — 3.1.0 release metadata.

### `fixportal-simulator-frontend`

- Modify `src/features/ci/CiBoard.tsx` — authenticated host callback.
- Modify `src/features/ci/CiBoard.contract.test.tsx` — request and result mapping coverage.
- Modify `package.json` and `package-lock.json` — consume the published 3.1.0 package.

---

### Task 1: Add the simulator's authenticated merge proxy

**Repository:** `D:/fix-portal/fixportal-simulator-backend`

**Files:**
- Modify: `tests/FixPortal.Simulator.Tests/Integration/CiController_HttpTests.cs`
- Modify: `src/FixPortal.Simulator.WebApi/Endpoints/CiEndpoints.cs`
- Modify: `contracts/rest/simulator.openapi.json`

**Interfaces:**
- Consumes: `CiBackendOptions.Url`, `CiBackendOptions.AdminKey`, and the existing `PlatformAdmin` policy.
- Produces: `POST /api/ci/merge` accepting `{ repo: string, pullNumber: number }` and preserving the CI backend's JSON/status response.

- [ ] **Step 1: Create an isolated backend worktree**

Use `superpowers:using-git-worktrees` from `D:/fix-portal/fixportal-simulator-backend`, branch from `origin/main`, and name the branch `feat/ci-admin-merge-proxy`. Do not use the primary checkout, which currently carries unrelated feature work.

- [ ] **Step 2: Write failing proxy tests**

Extend `CiController_HttpTests.cs` with these behaviours:

```csharp
[Fact]
public async Task Anonymous_merge_returns_401_in_Entra_mode()
{
    var handler = new StubCiHandler(HttpStatusCode.OK);
    using var factory = CreateFactory("Entra", handler);
    using var client = factory.CreateClient();

    using var response = await client.PostAsJsonAsync(
        "/api/ci/merge",
        new { repo = "public-repo", pullNumber = 42 }
    );

    response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    handler.Requests.Should().BeEmpty();
}

[Fact]
public async Task Platform_admin_merge_is_forwarded_with_admin_key_and_body()
{
    var handler = new StubCiHandler(
        HttpStatusCode.OK,
        """{"merged":true,"sha":"abc123"}"""
    );
    using var factory = CreateFactory("Disabled", handler);
    using var client = factory.CreateClient();

    using var response = await client.PostAsJsonAsync(
        "/api/ci/merge",
        new { repo = "public-repo", pullNumber = 42 }
    );

    response.StatusCode.Should().Be(HttpStatusCode.OK);
    (await response.Content.ReadAsStringAsync()).Should().Be(
        """{"merged":true,"sha":"abc123"}"""
    );
    handler.Requests.Should().ContainSingle().Which.Should().Be(
        new DownstreamRequest(
            HttpMethod.Post,
            "/api/dashboard/merge",
            "test-admin-key",
            """{"repo":"public-repo","pullNumber":42}"""
        )
    );
}

[Theory]
[InlineData("", 42)]
[InlineData("public-repo", 0)]
public async Task Invalid_merge_request_returns_400_without_calling_downstream(
    string repo,
    int pullNumber
)
{
    var handler = new StubCiHandler(HttpStatusCode.OK);
    using var factory = CreateFactory("Disabled", handler);
    using var client = factory.CreateClient();

    using var response = await client.PostAsJsonAsync(
        "/api/ci/merge",
        new { repo, pullNumber }
    );

    response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    handler.Requests.Should().BeEmpty();
}

[Fact]
public async Task Merge_preserves_downstream_error_status_and_body()
{
    var handler = new StubCiHandler(
        HttpStatusCode.Conflict,
        """{"error":"Pull request is not mergeable"}"""
    );
    using var factory = CreateFactory("Disabled", handler);
    using var client = factory.CreateClient();

    using var response = await client.PostAsJsonAsync(
        "/api/ci/merge",
        new { repo = "public-repo", pullNumber = 42 }
    );

    response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    (await response.Content.ReadAsStringAsync()).Should().Be(
        """{"error":"Pull request is not mergeable"}"""
    );
}
```

Add `using System.Net.Http.Json;`. Change the stub to accept an optional response body and record `HttpMethod`, path, admin key, and request body. Keep the existing snapshot assertions working.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
dotnet test --project tests/FixPortal.Simulator.Tests/FixPortal.Simulator.Tests.csproj --filter FullyQualifiedName~CiController_HttpTests
```

Expected: the new tests fail because `/api/ci/merge` does not exist; existing snapshot tests remain green.

- [ ] **Step 4: Implement the minimal endpoint**

Add a file-local request record and one route in `CiEndpoints.cs`:

```csharp
internal sealed record CiMergeRequest(string Repo, int PullNumber);

group
    .MapPost(
        "merge",
        async (
            CiMergeRequest merge,
            IHttpClientFactory httpClientFactory,
            IOptions<CiBackendOptions> options,
            HttpContext ctx
        ) =>
        {
            if (string.IsNullOrWhiteSpace(merge.Repo) || merge.PullNumber <= 0)
            {
                return Results.BadRequest(
                    new { error = "Repository and a positive pull request number are required." }
                );
            }

            var ci = options.Value;
            var httpClient = httpClientFactory.CreateClient(nameof(CiEndpoints));
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{ci.Url.TrimEnd('/')}/api/dashboard/merge"
            )
            {
                Content = JsonContent.Create(
                    new { repo = merge.Repo, pullNumber = merge.PullNumber }
                ),
            };
            request.Headers.Add("X-Admin-Key", ci.AdminKey);

            using var response = await httpClient.SendAsync(request, ctx.RequestAborted);
            var body = await response.Content.ReadAsStringAsync(ctx.RequestAborted);
            if (body.Length == 0)
            {
                return Results.StatusCode((int)response.StatusCode);
            }

            return Results.Content(
                body,
                response.Content.Headers.ContentType?.ToString() ?? "application/json",
                statusCode: (int)response.StatusCode
            );
        }
    )
    .RequireAuthorization("PlatformAdmin")
    .Produces(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status401Unauthorized)
    .Produces(StatusCodes.Status409Conflict)
    .Produces(StatusCodes.Status502BadGateway);
```

Add `using System.Net.Http.Json;`. Do not move validation or merge policy out of the CI backend.

- [ ] **Step 5: Verify GREEN and regenerate the REST contract**

Run the focused test again and expect every `CiController_HttpTests` case to pass. Then run:

```powershell
pwsh scripts/update-openapi-snapshot.ps1
```

Confirm `contracts/rest/simulator.openapi.json` gains only `POST /api/ci/merge` and its request/response schema.

- [ ] **Step 6: Run backend verification**

Run:

```powershell
dotnet build FixPortal.Simulator.slnx --no-restore
```

```powershell
dotnet test --project tests/FixPortal.Simulator.Tests/FixPortal.Simulator.Tests.csproj --no-restore
```

Expected: build and all tests pass with no new warnings.

- [ ] **Step 7: Commit the backend task**

```powershell
git add src/FixPortal.Simulator.WebApi/Endpoints/CiEndpoints.cs tests/FixPortal.Simulator.Tests/Integration/CiController_HttpTests.cs contracts/rest/simulator.openapi.json
```

```powershell
git commit -m "feat(ci): proxy authenticated pull request merges"
```

Do not push yet; the final branch gate performs the single allowed push.

---

### Task 2: Expose `mergeFetcher` from the component library

**Repository:** `D:/fix-portal/fixportal-ci-frontend`

**Files:**
- Modify: `packages/ci-frontend/src/CiBoard.test.tsx`
- Modify: `packages/ci-frontend/src/CiBoard.tsx`
- Modify: `README.md`
- Modify: `packages/ci-frontend/README.md`

**Interfaces:**
- Consumes: `CiConfig['mergeFetcher']` and existing `usePrMerge` preference logic.
- Produces: optional `CiBoardProps.mergeFetcher` with signature `(repo: string, pullNumber: number) => Promise<MergeResult>`.

- [ ] **Step 1: Create an isolated frontend worktree**

Use `superpowers:using-git-worktrees` from `D:/fix-portal/fixportal-ci-frontend`. Branch `feat/ci-admin-merge-controls` from commit `c9192e8` so the approved spec and this plan travel with the implementation; leave the primary checkout's unrelated image moves untouched.

- [ ] **Step 2: Write the failing component integration test**

In `CiBoard.test.tsx`, import `userEvent` and `vi`, create a snapshot containing one `readyToMerge: true` PR, then add:

```tsx
it('uses the host merge fetcher for an admin ready-PR action', async () => {
  const mergeFetcher = vi.fn().mockResolvedValue({ ok: true, sha: 'abc123' })
  render(
    <CiBoard
      adminSignal
      snapshotFetcher={async () => readySnapshot}
      adminSnapshotFetcher={async () => readySnapshot}
      mergeFetcher={mergeFetcher}
      storageNamespace="admin-merge"
    />,
  )

  await userEvent.click(
    await screen.findByRole('button', { name: 'Rebase-merge PR #42' }),
  )

  expect(mergeFetcher).toHaveBeenCalledOnce()
  expect(mergeFetcher).toHaveBeenCalledWith('ci-frontend', 42)
})
```

Use the existing `DashboardSnapshot` type; the PR fixture must include `number`, `title`, `author`, `htmlUrl`, `isDraft`, `createdAt`, and `readyToMerge`.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
npm test -w @fix-portal/ci-frontend -- src/CiBoard.test.tsx
```

Expected: FAIL because `CiBoard` does not pass the callback into `CiConfigProvider`, so the mock is not called.

- [ ] **Step 4: Add the public prop and pass it through**

In `CiBoard.tsx`, declare the prop by reusing the existing public config type:

```tsx
/** Authenticated host callback for a single rebase merge. */
mergeFetcher?: CiConfig['mergeFetcher']
```

Import `CiConfig`, destructure `mergeFetcher`, and include it in the existing provider value:

```tsx
<CiConfigProvider value={{
  apiBase,
  snapshotFetcher,
  snapshotCacheKey,
  adminSnapshotUrl,
  adminSnapshotFetcher,
  adminSnapshotCacheKey,
  mergeFetcher,
  storageNamespace,
  repositoryScope,
}}>
```

Do not change `usePrMerge`; it already uses this callback first.

- [ ] **Step 5: Verify GREEN and document the prop**

Run the focused test and expect it to pass. Add `mergeFetcher` to the prop tables in both READMEs with this contract: authenticated callback for a single rebase merge; hosts must keep credentials server-side and return a `MergeResult`.

- [ ] **Step 6: Run the component repository verification**

Run:

```powershell
npm run verify
```

```powershell
npm run test:e2e
```

```powershell
npm run test:package
```

Expected: lint, unit tests, typecheck, coverage, builds, browser tests, and package-consumer smoke pass.

- [ ] **Step 7: Commit the library seam**

```powershell
git add packages/ci-frontend/src/CiBoard.tsx packages/ci-frontend/src/CiBoard.test.tsx README.md packages/ci-frontend/README.md
```

```powershell
git commit -m "feat: expose authenticated merge callback"
```

Do not push yet.

---

### Task 3: Merge and deploy the simulator backend first

**Repository:** backend worktree from Task 1

**Interfaces:**
- Consumes: completed backend commit and repository review policy.
- Produces: live `POST /api/ci/merge` before any clickable host UI ships.

- [ ] **Step 1: Re-run the full backend gate and inspect the diff**

Run the build and full test commands from Task 1 again, then:

```powershell
git diff --check origin/main...HEAD
```

```powershell
git status --short
```

Expected: only the three planned backend files are changed and the worktree is clean.

- [ ] **Step 2: Push once and open the backend PR**

```powershell
git push -u origin feat/ci-admin-merge-proxy
```

Create one PR against `main`, describing the PlatformAdmin boundary, server-side key injection, and test evidence. Read `.claude/review-policy.json` for the committed paths; follow the resulting reviewer tier exactly. Immediately request the routine reviewer:

```powershell
$prNumber = gh pr view -R FixPortal/fixportal-simulator-backend --json number --jq .number
```

```powershell
gh pr comment $prNumber -R FixPortal/fixportal-simulator-backend --body "Gitar review"
```

- [ ] **Step 3: Wait for CI and review, then rebase-merge**

Read review comments rather than check names alone. Resolve any valid findings in local commits, run the full suite again, push once only if a follow-up is required, then request Gitar again after that push. Merge with:

```powershell
gh pr merge $prNumber -R FixPortal/fixportal-simulator-backend --rebase --delete-branch
```

- [ ] **Step 4: Deploy and verify the backend proxy**

Dispatch only the simulator backend production target:

```powershell
pwsh D:/fix-portal/fixportal-assets/scripts/fixportal-deploy.ps1 -Target sim-backend-prod
```

Watch the exact run ID printed by the helper. After it succeeds, verify an anonymous POST is rejected and the public snapshot remains readable:

```powershell
$body = @{ repo = 'fixportal-ci-frontend'; pullNumber = 1 } | ConvertTo-Json -Compress
```

```powershell
Invoke-WebRequest -Method Post -Uri 'https://www.fixportal.org/api/ci/merge' -ContentType 'application/json' -Body $body -SkipHttpErrorCheck | Select-Object StatusCode
```

```powershell
Invoke-WebRequest -Uri 'https://www.fixportal.org/api/ci/snapshot' | Select-Object StatusCode
```

Expected: merge returns `401` or `403`; snapshot returns `200`. Do not send a real authenticated merge during infrastructure verification.

---

### Task 4: Cut and verify `@fix-portal/ci-frontend` 3.1.0

**Repository:** component worktree from Task 2

**Files:**
- Modify: `packages/ci-frontend/CHANGELOG.md`
- Modify: `packages/ci-frontend/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the tested `CiBoard.mergeFetcher` API.
- Produces: public npm package `@fix-portal/ci-frontend@3.1.0`.

- [ ] **Step 1: Prepare exact release metadata**

Run:

```powershell
npm version 3.1.0 --workspace @fix-portal/ci-frontend --no-git-tag-version
```

Change the changelog so `## [Unreleased]` is empty and `## [3.1.0] - 2026-08-25` contains:

```markdown
### Added

- Admin hosts can supply `mergeFetcher` to rebase-merge ready pull requests without exposing server credentials to the browser.
- Ready pull requests render as actionable merge pills for admins, with per-repository `Merge all` when at least two are ready.

### Changed

- The vendored dark `--warn-text` token is re-synced to the shared design source (`#fcd34d`).

### Fixed

- Merge failures remain scoped to their repository, refresh stale snapshots, and never throw on malformed responses.
- The design-token drift check now verifies both explicit-dark and OS-dark blocks.
```

- [ ] **Step 2: Run the release-equivalent local gate**

Run each command separately:

```powershell
npm run verify
```

```powershell
npm run test:backend-contract -- D:/fix-portal/fixportal-ci-backend/contracts/dashboard-snapshot.v1.json
```

```powershell
npm run test:e2e
```

```powershell
npm run test:package
```

```powershell
npm run test:container
```

Expected: every command exits zero.

- [ ] **Step 3: Commit release metadata**

```powershell
git add packages/ci-frontend/CHANGELOG.md packages/ci-frontend/package.json package-lock.json
```

```powershell
git commit -m "release: bump @fix-portal/ci-frontend to 3.1.0"
```

- [ ] **Step 4: Push once, review, and merge the library PR**

Re-run `git diff --check origin/main...HEAD`, confirm only planned files plus spec/plan are present, then push once and open one PR. Follow `.claude/review-policy.json`, request `Gitar review`, wait for required CI/review, and rebase-merge with remote branch deletion.

- [ ] **Step 5: Create the release and watch the exact tag run**

Fetch `main` after the rebase merge and verify the commit titles from the feature branch appear on local `main`. Create the release:

```powershell
gh release create v3.1.0 -R FixPortal/fixportal-ci-frontend --target main --generate-notes --title "v3.1.0"
```

Find the `release.yml` run whose branch is exactly `v3.1.0`, retain its database ID, and watch that exact run to completion.

- [ ] **Step 6: Verify the public artifact**

```powershell
npm view @fix-portal/ci-frontend@3.1.0 version dist.integrity dist.tarball --json
```

Pack/install the published artifact or inspect its bundle and confirm it contains `mergeFetcher`, `Merge all`, and `Rebase-merge PR` before updating the consumer.

---

### Task 5: Wire the FixPortal host to the published package

**Repository:** `D:/fix-portal/fixportal-simulator-frontend`

**Files:**
- Modify: `src/features/ci/CiBoard.contract.test.tsx`
- Modify: `src/features/ci/CiBoard.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `@fix-portal/ci-frontend@3.1.0`, `POST /api/ci/merge`, `post`, `ApiError`, and `apiScopes.read`.
- Produces: a `mergeFetcher(repo, pullNumber)` callback returning the package's `MergeResult` shape.

- [ ] **Step 1: Create an isolated host worktree and install 3.1.0**

Use `superpowers:using-git-worktrees`, branch `feat/ci-admin-merge-controls` from the latest `origin/main`, then run:

```powershell
npm install @fix-portal/ci-frontend@3.1.0 --save-exact
```

- [ ] **Step 2: Write failing host callback tests**

In `CiBoard.contract.test.tsx`, use the real `setTokenGetter`, stub `fetch`, render the wrapper, extract `captured.props.mergeFetcher`, and add:

```tsx
test('supplies an authenticated merge callback to the shared board', async () => {
  setTokenGetter(async scopes => {
    expect(scopes).toEqual([apiScopes.read])
    return 'test-token'
  })
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ merged: true, sha: 'abc123' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ))
  vi.stubGlobal('fetch', fetchMock)
  render(<CiBoard />)

  const mergeFetcher = captured.props?.mergeFetcher as
    (repo: string, pullNumber: number) => Promise<unknown>
  await expect(mergeFetcher('repo-a', 42)).resolves.toEqual({ ok: true, sha: 'abc123' })
  expect(fetchMock).toHaveBeenCalledWith('/api/ci/merge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    body: JSON.stringify({ repo: 'repo-a', pullNumber: 42 }),
  })
})

test.each([
  [403, { error: 'ignored' }, 'Not authorised to merge'],
  [409, { error: 'Pull request is not mergeable' }, 'Pull request is not mergeable'],
])('maps merge HTTP %s to an inline failure', async (status, body, message) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify(body),
    { status, statusText: 'Failure', headers: { 'content-type': 'application/json' } },
  )))
  render(<CiBoard />)

  const mergeFetcher = captured.props?.mergeFetcher as
    (repo: string, pullNumber: number) => Promise<unknown>
  await expect(mergeFetcher('repo-a', 42)).resolves.toEqual({ ok: false, status, message })
})

test('maps a merge transport failure to Network error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  render(<CiBoard />)

  const mergeFetcher = captured.props?.mergeFetcher as
    (repo: string, pullNumber: number) => Promise<unknown>
  await expect(mergeFetcher('repo-a', 42)).resolves.toEqual({
    ok: false,
    status: null,
    message: 'Network error',
  })
})
```

Reset the token getter and unstub globals in `afterEach` so these tests cannot leak auth state.

- [ ] **Step 3: Run the focused test and verify RED**

```powershell
npx vitest run src/features/ci/CiBoard.contract.test.tsx
```

Expected: FAIL because `captured.props.mergeFetcher` is absent.

- [ ] **Step 4: Implement the callback using existing HTTP helpers**

Import `ApiError` and `post` from `../../api/client`, then add:

```tsx
const mergeFetcher = useCallback(async (repo: string, pullNumber: number) => {
  try {
    const result = await post<{ sha?: unknown }>(
      '/ci/merge',
      { repo, pullNumber },
      [apiScopes.read],
    )
    return {
      ok: true as const,
      sha: typeof result.sha === 'string' ? result.sha : '',
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      return { ok: false as const, status: null, message: 'Network error' }
    }
    return {
      ok: false as const,
      status: error.status,
      message: error.status === 401 || error.status === 403
        ? 'Not authorised to merge'
        : error.detail ?? error.code ?? `Merge failed (${error.status})`,
    }
  }
}, [])
```

Pass `mergeFetcher={mergeFetcher}` to `CiBoardLib`. Do not add another API utility.

- [ ] **Step 5: Verify GREEN and run the host gate**

Run the focused test again, then run separately:

```powershell
npm run lint
```

```powershell
npm run test
```

```powershell
npm run build
```

Expected: every command exits zero with no new warnings.

- [ ] **Step 6: Commit the host integration**

```powershell
git add src/features/ci/CiBoard.tsx src/features/ci/CiBoard.contract.test.tsx package.json package-lock.json
```

```powershell
git commit -m "feat(ci): enable authenticated dashboard merges"
```

---

### Task 6: Review, deploy, and verify the live FixPortal UI

**Repository:** host worktree from Task 5

**Interfaces:**
- Consumes: live simulator merge proxy and published package 3.1.0.
- Produces: deployed merge controls on `www.fixportal.org/ci` for PlatformAdmin users.

- [ ] **Step 1: Re-run the full host gate and inspect the branch**

Run `npm run lint`, `npm run test`, and `npm run build` fresh. Then run `git diff --check origin/main...HEAD` and confirm exactly the four planned files changed.

- [ ] **Step 2: Push once, review, and rebase-merge**

Push `feat/ci-admin-merge-controls` once, open one PR, follow `.claude/review-policy.json`, request `Gitar review`, and wait for CI plus the required reviewer. Apply any valid follow-up before merge, run the full gate again, then rebase-merge with remote branch deletion.

- [ ] **Step 3: Deploy only FixPortal production UI**

Dispatch:

```powershell
pwsh D:/fix-portal/fixportal-assets/scripts/fixportal-deploy.ps1 -Target sim-frontend-prod
```

Retain and watch the exact run ID printed by the helper. Do not dispatch YJC, dev, ThemeLab, or the full estate.

- [ ] **Step 4: Verify the live artifact and security boundary**

Fetch `https://www.fixportal.org/ci`, follow its current hashed `CiBoard-*.js` chunk, and verify the deployed bytes contain `Merge all`, `Rebase-merge PR`, and `/api/ci/merge`.

Verify:

- `GET https://www.fixportal.org/api/ci/snapshot` returns `200`;
- anonymous `POST https://www.fixportal.org/api/ci/merge` returns `401` or `403`;
- `GET https://ci.fixportal.org` still identifies as Guest/read-only and its bundle has no authenticated host callback;
- when the live snapshot has an eligible ready PR, an authenticated PlatformAdmin sees its actionable ready pill;
- `Merge all` appears only when at least two ready PRs belong to the same repository.

If no eligible PR exists, do not create or merge a dummy PR. Record the live bundle, auth-boundary, and automated interaction tests as the available evidence and state that the conditional visual check was not exercisable.
