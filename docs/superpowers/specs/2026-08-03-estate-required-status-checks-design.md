# Estate-wide required status checks

**Date:** 2026-08-03
**Status:** Approved, not yet implemented
**Scope:** All 29 non-archived repositories in the `FixPortal` GitHub organisation, plus
the `scaffold-ci` and `scaffold-repo` skills.

## Problem

Every repository in the estate has branch protection. None of it requires CI to pass.

A sweep of all 29 non-archived repositories on 2026-08-03 found a uniform shape: an
active ruleset on the default branch carrying `pull_request`, `deletion` and
`non_fast_forward` rules, with `required_approving_review_count: 0`. Three repositories
additionally carry legacy classic protection. Not one repository — under either
mechanism — declares `required_status_checks`.

The protection therefore governs *how* code lands (via a PR, rebase-only, no force-push,
no branch deletion) but says nothing about whether it is green. A pull request with
failing CI is mergeable today, and GitHub reports `mergeStateStatus: CLEAN` for it,
because GitHub was never told to have an opinion about check results.

This was discovered while designing a "ready to merge" board filter for
`fixportal-ci-frontend`. That filter is deferred and specified separately; it depends on
this change landing first, because without required checks GitHub's own merge verdict
carries almost no information.

## Decisions

Each decision below was taken explicitly during design. The rationale is recorded because
the alternatives are all defensible and the reasons are not recoverable from the diff.

### D1 — A uniform gate job, not per-repo context lists

Required contexts are matched by exact check-run name. The estate's build/test checks are
named inconsistently: `Backend (.NET)` in eight repositories, and elsewhere `backend`,
`build`, `build-and-test`, `checks`, `Verify (lint + test)`, `Frontend (UI)`,
`Web (React/Vite)`, `Design package`, `Build and pack`, and
`Build, pack, and verify consumer`. No single existing name could be required
estate-wide.

Hard-coding 29 bespoke context lists into branch protection was rejected: a job rename
then silently blocks every merge in that repository until someone connects the two
facts, and nothing in the rename's diff points at the protection rule.

Instead each repository gains one aggregating job with a stable, identical name. The
mapping from that name to the real jobs lives in the workflow beside the jobs it names,
where a rename is visible in the same file.

### D2 — Required set is `CI Gate` plus `Review policy intact`

`needs:` cannot cross workflow files, so a gate aggregates only jobs in its own file.
The estate does not have one CI workflow per repository: `fixportal-ci-frontend` alone
has four pull-request-triggered workflows, and `Review policy intact` is a standalone
workflow in 24 repositories.

Requiring only `CI Gate` would therefore leave the review-policy guard — the workflow
protecting `.claude/review-policy.json` from being silently emptied — entirely advisory.
Requiring both names keeps full uniformity across the estate at the cost of one job
rename in one repository (see C3).

Folding `react-doctor` and `review-policy-guard` into `ci.yml` so a single gate could
cover them was rejected: it restructures ~27 workflow files and couples unrelated
concerns into one concurrency group, to save one entry in a two-entry list.

### D3 — `strict_required_status_checks_policy: false`

Enabling it requires every pull request to be up to date with the default branch before
merging. On a rebase-merge estate with this merge frequency that forces near-constant
rebases and puts every open pull request into `BEHIND` the moment anything lands.

### D4 — CodeQL is not in the required set

`CodeQL` reports on most repositories via the `github-advanced-security` app, and
requiring it is defensible in principle. It is excluded because code scanning may be
switched off across the estate in the near future, and a required context whose producer
is removed blocks every merge in every repository that declared it.

### D5 — `skipped` counts as a pass; `failure` and `cancelled` do not

The gate must tolerate skipped upstream jobs, because job-level `if:` conditions and
path filtering are how repositories legitimately avoid running work that does not apply
to a given pull request. Push-only jobs are the common case — for example
`fixportal-ci-frontend`'s `docker` / `Publish Image (GHCR)` job, gated to push on `main`
at `.github/workflows/ci.yml:59-63`, which skips on every pull request.

The accepted cost: a job skipped by a *bug* in its `if:` expression passes the gate
silently. The alternative — treating `skipped` as failure — blocks merges on ordinary,
correct path filtering, which is worse and would be hit immediately.

### D6 — Rollout pull requests are tiered NORMAL, with no reviewer requested

`.github/workflows/**` is HIGH in every repository's `review-policy.json`, which
normally requires CodeRabbit. Applied here that would spend roughly 27 CodeRabbit reviews
— against an allowance that degrades from 30 reviews per rolling 7 days, metered per
developer identity across all repositories — on a ten-line addition that is
byte-identical in every repository.

Chris authorised NORMAL tiering for this rollout explicitly on 2026-08-03, on the grounds
that a mechanical change establishing the review process itself is not what the HIGH tier
exists to protect. This is a scoped, one-off authorisation for this rollout; it does not
alter any repository's committed `review-policy.json`.

Gitar is additionally not requested: it is currently rate limited. These pull requests go
up with no AI reviewer at all.

Because CodeRabbit is label-triggered (`auto_review.enabled: false` together with
`labels: ["review-high"]`), NORMAL is achieved by the `review-high` label not being
applied. The gate hook applies that label at PR-create time when it computes HIGH, so
every rollout pull request must have its labels read back after creation and the label
stripped if present.

### D7 — Merge authority

Chris authorised creating and rebase-merging the rollout pull requests without further
sign-off, conditional on CI passing. Green CI must be positively verified per pull
request before merging, not assumed.

## The gate job

Added to the workflow file containing each repository's quality jobs:

```yaml
  ci-gate:
    name: CI Gate
    if: always()
    needs: [build]           # per-repo: the quality jobs in THIS file
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Fail if any upstream job did not succeed
        if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
        run: |
          echo "Upstream results: ${{ join(needs.*.result, ', ') }}"
          exit 1
```

`if: always()` at job level is load-bearing. Without it the gate is skipped whenever a
`needs` job fails — and a skipped job produces no check run at all, so a required context
that never reports leaves the pull request permanently blocked. This is the single
easiest way to get this pattern wrong.

`needs:` lists only the quality jobs in that file. Push-only and deploy jobs are omitted;
by D5 they would pass anyway when skipped, but listing them makes the gate's meaning
unclear.

The hosting workflow must trigger on `pull_request` with **no workflow-level path
filter** (see C1).

## The ruleset rule

PATCHed into each repository's existing `require-pr-to-default` ruleset, resolved by name
because the id differs per repository:

```json
{
  "type": "required_status_checks",
  "parameters": {
    "strict_required_status_checks_policy": false,
    "do_not_enforce_on_create": false,
    "required_status_checks": [
      { "context": "CI Gate", "integration_id": 15368 },
      { "context": "Review policy intact", "integration_id": 15368 }
    ]
  }
}
```

`integration_id: 15368` is the GitHub Actions app, read from live check runs rather than
recalled. Pinning it prevents any other app posting a check run under the same name and
satisfying the requirement.

The rulesets API replaces the entire `rules` array on PATCH. The script therefore reads
the current rules, appends the new rule only if absent, and writes the whole array back,
leaving the existing `pull_request`, `deletion` and `non_fast_forward` rules untouched.

## Rollout order

Per repository, in this order, without exception:

1. Gate job merged to the default branch.
2. Gate observed reporting a check run named exactly `CI Gate` on a real pull request.
3. Ruleset PATCH applied.
4. Ruleset re-read from the API and the rule confirmed present.

Reversing steps 1 and 3 blocks every open pull request in that repository on a context
that has never existed. The apply script enforces this by refusing any repository where
`CI Gate` has not been observed.

`fixportal-ci-frontend` and one .NET repository go first, proving the gate reports
correctly on both stacks. The remaining repositories follow immediately afterwards in a
single pass — the sequencing exists to catch a broken gate pattern early, not to stage
the rollout over time.

## Per-repository carve-outs

- **C1 — `fixportal-simulator-frontend`.** Its primary `ci.yml` carries a workflow-level
  path filter, so it does not run on every pull request. The filter moves to job-level
  `if:` conditions; the workflow then always runs, jobs skip as before, and the gate
  always reports. Five other path-filtered workflows exist across the estate
  (`infra.yml`, `mutation-web.yml`, `publish-demo-host.yml`, `deploy-content.yml`,
  `dotnet-tests.yml`) but none hosts a gate, so none needs changing.
- **C2 — `fixportal-diagnostic-explorer`.** CI is split across files: `backend` lives in
  `dotnet-tests.yml`, with `coverage` and `stryker-web` elsewhere. `dotnet-tests.yml`
  carries a workflow-level path filter, so hosting the gate there would violate the
  constraint C1 exists to enforce — the gate would not report on a pull request that
  misses the filter, and that pull request would never be mergeable. This repository
  therefore takes the C1 treatment as well: the filter on `dotnet-tests.yml` moves to
  job-level `if:` conditions, and the gate is hosted there over `backend`. Mutation
  testing lives in another file and is deliberately not merge-blocking.
- **C3 — `fixportal-qa`.** Its guard job is named `Review policy guard`; it is renamed to
  `Review policy intact` to match the other 24 repositories. It has no build, so its gate
  wraps `Docs (markdownlint)`.
- **C4 — `personal-resumes`.** Reports only `[code]smith` and `Gitar`; it has no CI to
  gate. It receives no `CI Gate` requirement and is recorded as a known gap rather than
  given a gate that wraps nothing.

## Automation

A single PowerShell script with three modes:

- `-Audit` — read-only. Per repository: current ruleset rules, whether `CI Gate` has
  been observed reporting, and the planned rule. Produces the table reviewed before any
  write.
- `-Apply` — PATCHes the ruleset. Refuses any repository failing the step-2 precondition.
  Idempotent: a repository already carrying the rule is reported and skipped.
- `-Rollback` — removes the `required_status_checks` rule, leaving other rules intact.

Safety requirements, all of which follow from failures already observed:

- Assert on parsed values (non-empty, expected keys, expected row count) before acting.
  Piping a null or empty value to a cmdlet invokes it zero times and raises nothing, so a
  pipe is never a validation.
- Re-read every ruleset from the API after PATCH and assert the rule is present. A write
  that reports success is not evidence the state changed.
- Never treat a `gh api` exit as success by inspecting only stdout: `gh` prints error
  response bodies to stdout, so `ConvertFrom-Json` will happily parse a 404 body into an
  object that looks like a result. This produced a wrong column in the very sweep that
  motivated this document. Check `$LASTEXITCODE`, or extract with `--jq` and assert the
  result is non-empty.

## Skill updates

- **`scaffold-ci`** owns `.github/workflows/ci.yml`, and gains the gate job template plus
  the constraint that the hosting workflow carries no workflow-level path filter.
- **`scaffold-repo`** owns the branch ruleset, and gains the `required_status_checks`
  rule so new repositories are created with it in place.

The split follows existing skill ownership boundaries, not a natural seam in the change.
A new repository scaffolded through both skills gets a gate and a requirement that
references it, in that order.

## Verification

- Audit output shows `required_status_checks` present on all applicable repositories.
- A deliberately failing pull request in the pilot repository is confirmed unmergeable.
- A passing pull request in the pilot repository is confirmed mergeable.
- A docs-only pull request in `fixportal-simulator-frontend` is confirmed to report
  `CI Gate` and remain mergeable, proving C1.
- `gh api repos/FixPortal/<repo>/rulesets/<id>` re-read confirms the rule for every
  repository touched.

## Out of scope

- The `ready to merge` board filter for `fixportal-ci-frontend`, which motivated this
  work and is specified separately. It depends on this change.
- Required approving reviews. `required_approving_review_count` stays at 0 estate-wide.
- CodeQL as a required context (D4).
- Any change to committed `review-policy.json` tiering. D6 is a scoped authorisation for
  this rollout only.

## Risks

- A required context that stops reporting blocks every merge in that repository. The two
  chosen names are produced by workflows in the repository itself, so the failure is
  self-inflicted and self-fixable, but it is still the sharpest edge here.
- `skipped`-counts-as-pass means a mis-authored `if:` silently satisfies the gate (D5).
- The gate is only as good as its `needs:` list. A quality job added later but not added
  to `needs:` is not merge-blocking, and nothing detects that.
