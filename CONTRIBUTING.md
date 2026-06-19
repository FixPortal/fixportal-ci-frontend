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

Prerequisites: **Node 22+**.

```bash
git clone https://github.com/FixPortal/fixportal-ci-frontend.git
cd fixportal-ci-frontend
npm install
npm run dev          # builds the library, serves the standalone app on :5173
```

## Before you open a PR

Run the full local check — CI runs the same and must pass before a merge:

```bash
npm test             # library unit tests (Vitest)
npm run lint         # ESLint across the workspace
npm run build:lib    # build the library (tsup → ESM + .d.ts + CSS)
npm run build:app    # type-check and build the standalone app
```

## Branches and commits

- Branch from `main` using `feat/<scope>`, `fix/<scope>`, or `chore/<scope>`.
- Write clear, present-tense commit subjects.
- PRs merge via **rebase** — no merge commits, no squash. Keep your branch
  rebased on `main`.

## What makes a good PR

- One focused change per PR.
- Tests for new behaviour or a bug fix that would have caught the regression.
- No new runtime dependency unless a few lines of code genuinely cannot do it.
- Public API changes (`CiBoard` props, exported types) called out in the PR
  description.
