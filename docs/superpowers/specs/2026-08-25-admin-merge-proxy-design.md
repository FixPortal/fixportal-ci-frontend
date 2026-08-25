# Authenticated CI Merge Controls

## Problem

The merge controls exist on `fixportal-ci-frontend` main but are absent from
`www.fixportal.org/ci` because the site consumes the older published
`@fix-portal/ci-frontend` 3.0.0 package. Publishing the current library alone
would still leave the controls unusable: the FixPortal host has authenticated
guest and admin snapshot proxies, but no authenticated merge proxy, and the
library's existing `mergeFetcher` configuration seam is not exposed by
`CiBoard`.

## Goals

- Let signed-in PlatformAdmin users rebase-merge ready pull requests from
  `www.fixportal.org/ci`.
- Keep the CI backend's shared admin key on the server.
- Preserve the existing single-PR and per-repository `Merge all` behaviour and
  inline errors.
- Release and deploy the complete path in dependency order.

## Non-goals

- `ci.fixportal.org` remains a public, read-only standalone dashboard.
- Do not add a second merge implementation, queue, batch endpoint, or client
  dependency.
- Do not change the CI backend's merge policy or readiness calculation.

## Design

### Component library

Add the existing `CiConfig.mergeFetcher` callback to `CiBoardProps` and pass it
through `CiConfigProvider`. `usePrMerge` already prefers this callback over its
default same-origin POST, so no merge orchestration changes are needed.

The callback remains optional. Existing consumers continue using the default
`{apiBase}/api/dashboard/merge` path, and guest boards remain read-only.

### Simulator backend

Add `POST /api/ci/merge` beside the existing snapshot proxy endpoints. The
endpoint:

1. requires the existing `PlatformAdmin` authorization policy;
2. accepts `repo` and positive `pullNumber` values;
3. forwards them to the CI backend's `POST /api/dashboard/merge` endpoint;
4. adds the server-held `X-Admin-Key` header; and
5. preserves the upstream status code and JSON response body.

The CI backend remains the authority for repository allow-listing, current
mergeability, and rebase-only merge policy. The simulator proxy adds only its
existing user-authentication boundary and secret injection.

### FixPortal frontend host

Add a memoized `mergeFetcher` to the CI wrapper. It sends the existing MSAL
read-scope bearer token to `/api/ci/merge`, maps success and error responses to
the library's `MergeResult`, and passes the callback to `CiBoard`.

The browser never receives or sends `X-Admin-Key`.

### Data flow

```text
PlatformAdmin browser
  -> POST /api/ci/merge + Entra bearer token
  -> simulator API authorizes PlatformAdmin
  -> POST ci.fixportal.org/api/dashboard/merge + X-Admin-Key
  -> CI backend validates snapshot/repository/PR and requests a rebase merge
  -> status + JSON travel back to the existing inline UI result handling
```

## Error handling

- Anonymous or non-admin callers are rejected by the simulator authorization
  policy before the CI backend is contacted.
- Invalid request data returns `400` without an upstream request.
- CI backend `409`, `502`, and other error responses retain their body and
  status so the library can show the real failure and refresh its snapshot.
- Transport failures return the host callback's standard network-error result.

## Tests

- Component library: prove `CiBoard.mergeFetcher` reaches an actionable ready
  PR and is called instead of the default endpoint.
- Simulator backend: prove anonymous rejection, PlatformAdmin forwarding,
  `X-Admin-Key` injection, request validation, and upstream status/body
  preservation.
- FixPortal frontend: prove the wrapper supplies `mergeFetcher`, sends the
  bearer token and body to `/api/ci/merge`, and maps success/error results.
- Run each repository's full local verification suite before pushing.

## Release and deployment

1. Merge and deploy the simulator backend proxy first.
2. Publish the additive component change as `@fix-portal/ci-frontend` 3.1.0.
3. Update the simulator frontend to 3.1.0 with the host callback.
4. Deploy `fixportal-prod-ui` from the updated simulator frontend mainline.
5. Verify the live bundle contains the merge controls, anonymous proxy access
   is rejected, the public snapshot remains readable, and an authenticated
   PlatformAdmin can see actionable ready-PR pills when eligible PRs exist.
