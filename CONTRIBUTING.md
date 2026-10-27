# Contributing

Thanks for your interest in improving this project. It is maintained on a
best-effort basis; issues and pull requests are welcome.

## Ground rules

- Be civil. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- By contributing, you agree your contributions are licensed under the
  [Apache License 2.0](LICENSE), the same licence as the project.
- Open an issue before a large change so we can agree the approach before you
  invest the time.

## Getting set up

Prerequisites: **npm 11.10 or newer** (root `package.json` `engines.npm`; `.npmrc`
sets `min-release-age`, which needs npm 11.10+). CI runs Node 24; the Docker image
builds on Node 22.

```bash
git clone https://github.com/FixPortal/fixportal-ci-frontend.git
cd fixportal-ci-frontend
npm install
npm run dev          # builds the library, serves the standalone app on :5173
```

## Before you open a PR

Run the local check. `npm run verify` bundles most of what CI runs, in this order:
`npm audit --omit=dev --audit-level=high`, `npm run format` (Prettier check), `npm run lint`,
`npm run test`, `npm run test:scripts`, library typecheck, library coverage gate,
`npm run build:lib` and `npm run build:app` (`package.json` `verify` script):

```bash
npm run verify
```

CI (`.github/workflows/ci.yml`) additionally runs, and `verify` does not:

- the Stryker/Vitest compatibility canary (`scripts/assert-stryker-compat.mjs`)
- the package LICENSE and NOTICE copy check
- `npm run test:backend-contract` against the backend repo's contract file
- the Python policy-checker and release-gate tests under `.github/scripts/`
- `npm run test:package` (package consumer smoke)
- `npm run test:e2e` (Playwright, Chromium) and `npm run test:container` (production nginx container)
- actionlint, and the gate-coverage and canonical-asset checks

All of these must pass before a merge; the `CI Gate` job aggregates them.

## Branches and commits

- Branch from `main` using `feat/<scope>`, `fix/<scope>`, or `chore/<scope>`.
- Write clear, present-tense commit subjects.
- PRs merge via **rebase** — no merge commits, no squash. Keep your branch
  rebased on `main`.

## What makes a good PR

- One focused change per PR.
- Tests for new behaviour or a bug fix that would have caught the regression.
- Anything a consumer of the package would notice gets a bullet under
  `## [Unreleased]` in [packages/ci-frontend/CHANGELOG.md](packages/ci-frontend/CHANGELOG.md),
  under `Added` / `Changed` / `Fixed` / `Removed`. Write it for someone upgrading the
  package, not for someone reading the diff. The release that ships it moves those
  bullets under its version heading. Internal-only changes (refactors, test or CI work)
  need no entry.
- No new runtime dependency unless a few lines of code genuinely cannot do it.
- Public API changes (`CiBoard` props, exported types) called out in the PR
  description.
