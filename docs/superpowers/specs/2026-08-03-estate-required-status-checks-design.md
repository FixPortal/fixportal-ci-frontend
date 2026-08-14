# Estate-wide required status checks

**Date:** 2026-08-03
**Status:** Implemented 2026-08-03. 28 of 29 repositories carry the
`required_status_checks` rule; `personal-resumes` is the only exclusion, by D8/C4.
Verified by re-reading each ruleset from the API on 2026-08-04 — and note that a
single read is not proof: two repositories first came back without the rule and
returned it on a second read minutes later, with nothing applied in between. Treat a
`MISSING` result as unconfirmed until a second read agrees. The rollout is applied and
audited with `~/.agents/scripts/apply-required-checks.ps1`, which lives outside every
repository and carries the per-repo ruleset-name overrides.
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

### D7 — Gate coverage is asserted, not trusted

The gate is only as good as its `needs:` list, and nothing about adding a new quality job
prompts anyone to wire it in. A `gate-coverage` job therefore parses the hosting workflow
and fails if any job in the file is absent from the gate's `needs:` and not named in
`GATE_EXEMPT`. `ci-gate` depends on it, so drift fails the required context.

It is a separate job rather than a step inside `ci-gate` deliberately: the gate blocks
every merge in the repository, so it stays a pure aggregator of `needs.*.result` with no
checkout, no parser and no network. The moving parts live somewhere that can fail without
implicating the mechanism itself.

`GATE_EXEMPT` is an explicit job-id list rather than an inferred rule (such as "anything
with a push-only `if:`"). Exemption is a decision, and a decision that grants itself
automatically is not reviewable.

### D10 — the assertion runs as Python, with no shell in the path

It began as a bash script wrapping a Python heredoc. Three repositories then failed the
new required check with `assert-gate-coverage.sh: line 12: set: pipefail / : invalid
option name` — bash reading the last word of `set -euo pipefail` as `pipefail\r`, because
the file was checked out with CRLF.

The instructive part is why the other repositories passed: **every committed blob carried
CRLF, including theirs.** They passed by accident of checkout configuration, and
`fixportal-codestyle` and `fixportal-learning` have near-identical `.gitattributes` yet
behaved differently. So the green repositories were never correct, merely lucky.

Fixing it per repository with `.gitattributes` was rejected on that basis: it would leave
every repository one `* text=auto eol=crlf` away from a red required check, and the
symptom points at the gate rather than at line endings, so the next person to hit it pays
the same diagnosis cost. The logic was already Python and Python is indifferent to CRLF,
so the wrapper was removed rather than repaired. Verified against a deliberately
CRLF-mangled copy.

### D8 — `personal-resumes` gets no CI

It has no build, no tests and nothing to gate. Adding a CI workflow purely so the
requirement has something to attach to would be process for its own sake. It is recorded
as a deliberate gap: the one repository in the estate where anything can merge.

### D9 — Merge authority

Chris authorised creating and rebase-merging the rollout pull requests without further
sign-off, conditional on CI passing. Green CI must be positively verified per pull
request before merging, not assumed.

## The gate job

Added to the workflow file containing each repository's quality jobs:

```yaml
  gate-coverage:
    name: Gate coverage
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Assert every job in this workflow is gated
        env:
          # Jobs deliberately outside the gate, by job id. Push-only publish and
          # deploy work belongs here; quality jobs never do.
          GATE_EXEMPT: docker
        # python3 directly, never through a shell wrapper -- see D10.
        run: python3 .github/scripts/assert_gate_coverage.py .github/workflows/ci.yml

  ci-gate:
    name: CI Gate
    if: always()
    needs: [build, gate-coverage]   # per-repo: the quality jobs in THIS file
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions: {}
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
  path filter, but the filter's first entry is `'**'`, which matches every path — so it
  is a no-op and the workflow does in fact run on every pull request. No surgery is
  required for the gate to report. The dead filter should still be deleted, because
  anyone narrowing it later would silently stop the required context reporting and block
  every merge in the repository, with nothing connecting the two changes.
  This repository was deferred during the rollout because it carried substantial
  uncommitted work; it has since been gated and its ruleset now carries the rule.
  The dead filter has since been deleted, and `ci.yml` now carries a comment recording why
  the workflow deliberately has no workflow-level `paths:` filter. Its `push` trigger is
  narrowed to `main` and tags for a separate reason — a `branches: ['**']` wildcard fires
  both a push run and a pull_request run for every commit on a branch with an open PR, and
  the two land in different concurrency groups by construction, so no expression can dedupe
  them. Five other path-filtered workflows exist across the
  estate (`infra.yml`, `mutation-web.yml`, `publish-demo-host.yml`, `deploy-content.yml`,
  `dotnet-tests.yml`) but none hosts a gate, so none needs changing.
- **C2 — `fixportal-diagnostic-explorer`.** Its CI is split across `ci.yml` (`backend`),
  `coverage.yml`, the path-filtered `dotnet-tests.yml` (`unit-tests`) and the
  path-filtered `mutation-web.yml` (`stryker-web`). `ci.yml` is unfiltered, so it hosts
  the gate over `backend` and no filter surgery is required. The path-filtered workflows
  host nothing and are deliberately not merge-blocking.
- **C3 — `fixportal-qa`.** Its guard job is named `Review policy guard`; it is renamed to
  `Review policy intact` to match the rest of the estate. It has no build, so its gate
  wraps the `docs` job.
- **C4 — `personal-resumes`.** Reports only `[code]smith` and `Gitar`; it has no CI to
  gate. Per D8 it receives no `CI Gate` requirement and no new workflow.
- **C5 — `fixportal-initiator`.** Had `ci.yml` but no `review-policy-guard.yml`, so
  `Review policy intact` could not report there and requiring it would have blocked every
  merge. Its required set was `["CI Gate"]` alone. The guard workflow has since been added
  in that repository and its `require-pr-to-default` ruleset now requires the estate pair,
  `["CI Gate", "Review policy intact"]` — read back from the API on 2026-08-14. The
  carve-out is therefore closed and no longer an exception.
- **C6 — `fixportal-engineering-system`.** Has only `review-policy-guard.yml` and no
  `ci.yml` — no build, no tests, nothing for a gate to aggregate. Required set is
  `["Review policy intact"]` alone.
- **C7 — `fixportal-quickfixn`.** Two pull-request workflows each expose a `build` job.
  Resolved by inspection: `dotnet.yml` is upstream's and is scoped to `master`, so it
  never runs on a pull request against this fork's default branch; `fixportal-ci.yml` is
  the FixPortal one and is scoped to `fpsim`. The gate hosts in `fixportal-ci.yml`, and
  this repository's base branch is **`fpsim`, not `main`** — any tooling that assumes
  `origin/main` is wrong here.
- **C8 — not cloned locally.** `fixportal-agents-skills`, `fixportal-claude` and
  `fixportal-claude-skills` had no local checkout. Now cloned and gated.
  `fixportal-claude` needed one extra change: it is a configuration-backup repository
  using a fail-safe allow-list `.gitignore` (`/*`, then explicit un-ignores), so
  `/.github/*` swallowed the new script. Three matching entries were added. Without them
  the gate would fail in CI on a file that exists locally and is absent from the clone
  the runner checks out — the worst shape of this bug, because it looks like a script
  error rather than a packaging one.

Per-repository required sets are therefore not universally the same pair. C6 takes one
context and C4 takes none; C5 took one at rollout and has since moved to the full pair. The apply script's precondition — refusing any
repository where a required context has not been observed reporting — is what makes this
safe: a mis-set context is refused rather than applied.

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
  `gate-coverage` does not help here: it proves a job is wired into the gate, not that
  the job actually ran.
- `gate-coverage` only sees the workflow file it is given. A quality job added to a
  *different* workflow in the same repository is still not merge-blocking, and nothing
  detects that.
