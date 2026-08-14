# Feature-complete Review Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed frontend release-readiness gaps, update the newcomer documentation, and replace the stale dashboard image with a deterministic current screenshot.

**Architecture:** Keep the existing workspace, components, and documentation structure. CI runs the tests already present in both workspaces and invokes the configured library coverage gate. Unknown chip states reuse one shared normalizer. Documentation is corrected in living files only; dated design records remain historical.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, npm workspaces, GitHub Actions, Markdown.

## Global Constraints

- Work only on `reviewer-findings-batch1` in the dedicated review worktree.
- Do not rewrite dated files under `docs/superpowers/specs` or older plans.
- Do not replace diagrams merely to change format. Correct factual text and diagram labels only.
- Do not add dependencies, a documentation framework, or a screenshot-generation framework.
- The new screenshot must be deterministic, show review pills and ready-to-merge state, and be backed by semantic E2E assertions.
- Keep all existing public APIs compatible.

---

### Task 1: Close the frontend code, CI, documentation, and screenshot gaps

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `packages/ci-frontend/src/lib/stateLabel.ts`
- Modify: `packages/ci-frontend/src/components/SignalChip.tsx`
- Modify: `packages/ci-frontend/src/components/JobLaneRow.tsx`
- Test: the existing SignalChip and JobLaneRow test files
- Modify: `README.md`
- Modify: `packages/ci-frontend/README.md`
- Modify: `docs/setup-guide.md`
- Modify: `docs/architecture/overview.md`
- Modify: `CHANGELOG.md`
- Modify: `e2e/dashboard.spec.ts`
- Update: platform Playwright snapshots and `docs/dashboard.png`

- [ ] Make the root `test` script run every workspace test script with `--workspaces --if-present`.
- [ ] Keep the CI test step, add the existing package typecheck, and invoke the existing library coverage script so its configured floors gate PRs.
- [ ] Add failing component tests showing an unfamiliar runtime state receives `chip--unknown`, then add one shared state normalizer and use it in both raw modifier-class call sites.
- [ ] Remove the root README YAML frontmatter that GitHub renders as a table.
- [ ] Rename the visible “Idiot’s guide” wording to “Neophyte’s guide”. Add an Unreleased changelog entry explaining that the old joke was at the maintainers’ own expense, but on reflection they were uncomfortable with the wording.
- [ ] Correct the setup guide for a Windows-first newcomer, peer dependency wording, reviewer configuration prerequisites, and the current board-local theme selector.
- [ ] Document every current `CiBoard` prop in both consumer READMEs without introducing a new docs abstraction.
- [ ] Correct living architecture text for current components and review/ready-to-merge data. Remove brittle generated degree counts. Preserve historical records and existing diagram format.
- [ ] Expand the deterministic E2E fixture to show review pills and ready-to-merge state, add semantic assertions for them, refresh both supported snapshots, and copy the representative current view to `docs/dashboard.png`.
- [ ] Run `npm test`, package typecheck, coverage, lint, both builds, and the Playwright suite.
- [ ] Commit the completed task locally; do not push.
