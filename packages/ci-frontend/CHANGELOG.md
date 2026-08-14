# Changelog

All notable changes to `@fix-portal/ci-frontend` are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are reconstructed from the repository's tag history. Releases before 1.3.0 are
listed for completeness only: they were published from a private history that was not
carried into the public repository, so there are no commits to describe them from.

## [Unreleased]

### Changed

- Renamed the visible “Idiot's guide” wording to “Neophyte's guide”. The old joke was at
  the maintainers' own expense, but on reflection we were uncomfortable with the wording.

## [2.6.1] - 2026-08-13

### Added

- The published tarball now carries its own `README.md`, `LICENSE` and `NOTICE`. npm reads
  those from the package directory rather than the workspace root, so every release up to
  this one showed "No README data found" on the registry and shipped no licence text
  despite declaring Apache-2.0.

### Changed

- The repository builds from a clone with no credentials. The dashboard app previously
  imported design tokens from a private package, which made a fresh clone and every fork's
  CI fail at install. It now consumes this package's own `tokens.css`, the same entry point
  an external consumer uses.

## [2.6.0] - 2026-08-12

### Added

- The legend explains that the GitHub scanning pills (CodeQL, Code Quality, Secret
  Scanning) report only on public repositories, so a permanently absent pill on a private
  repository reads as expected rather than broken.

## [2.5.0] - 2026-08-11

### Added

- A "Ready to merge" pill on both PR rows and PR cards.

### Fixed

- WCAG findings CIF-001 to CIF-005 remediated, including a single header title and a
  documented CORS pairing.
- The skip-link target is namespaced, and heading and skip-link semantics are covered by
  tests.
- Failed scans render an explicit no-value state instead of a misleading zero, and the
  summary is ordered attention-first.
- `--text-faint` carries the upstream AA contrast correction.

## [2.4.0] - 2026-08-05

### Added

- Controlled CI repository scope, so a board can be pointed at an explicit set of
  repositories.

## [2.3.0] - 2026-08-04

### Added

- A "Ready to merge" filter chip on the board.

## [2.2.0] - 2026-08-02

### Added

- Review pills on the PR row, right-aligned.

### Fixed

- PR-row selectors scoped so pill anchors keep their chip colour rather than inheriting the
  row's link styling.

## [2.1.0] - 2026-07-31

### Added

- `ReviewPills`, the review-signal contract and its label helper.
- Review pills on the PR card in the stepper.
- Repository search matches open pull request titles as well as repository names.

### Fixed

- Malformed signal entries are skipped rather than thrown on, and unrecognised states
  render as unknown with unique keys — a vanished pill would claim "reviewer not
  configured", which is a stronger and less accurate statement than "status unknown".
- `isAllowedHref` hardened against untrusted shapes.
- A disabled pill is distinguished from a pending one by shape, not opacity alone.
- Contrast raised on pending and disabled pill dots.

## [2.0.1] - 2026-07-18

### Fixed

- Adversarial review findings remediated.

## [2.0.0] - 2026-07-17

### Changed

- **Breaking.** `RepositorySnapshot.deploys` and `RepositorySnapshot.packages` are now
  `JobSignal[] | null`, and `DashboardSnapshot.ciTrend` is now `CiTrendBucket[] | null`.
  Consumers that assumed an array must handle `null`.

### Added

- `RepositorySnapshot.lastMergedPr`, `WorkflowRun.repository`, `WorkflowRun.workflowFile`,
  `CiTrendBucket.isBackfilled` and `DashboardSnapshot.publicCiTrend`, all optional.
- A contract test over the snapshot types.

### Fixed

- Admin controls gated on their source.
- Dashboard responses hardened; the dashboard is retained during refresh errors and awaits
  a manual retry rather than racing it.
- Responsive layout stabilised and the mobile summary grid contained.
- `--text-faint` darkened in light mode to meet WCAG AA contrast.

## [1.10.0] - 2026-07-02

### Fixed

- Adversarial audit remediation.

## [1.9.0] - 2026-06-29

### Changed

- Search moved to the toolbar's top row with the scope label beneath the legend.
- Legend typography: monospace caps labels, metric name and description split.

### Fixed

- Legend link hover uses `var(--text)` so the feedback is visible.

## [1.8.0] - 2026-06-29

### Changed

- Legend polish and toolbar restructure.

## [1.7.0] - 2026-06-27

### Added

- A collapsible `LegendRow`, wired into the sticky header; the per-section footer legends
  are removed.
- Board scope text shows a live count while filters are active.

### Fixed

- Focus-visible ring on the legend toggle, and a larger touch target.

## [1.6.1] - 2026-06-25

### Changed

- Snapshot polling interval reduced to 30 seconds, halving update lag.

## [1.6.0] - 2026-06-24

### Fixed

- Adversarial review of repository filtering and the nginx proxy.
- Accessibility contrast fixes and render micro-optimisations.
- Semantic HTML corrections and removal of a URL-prefilled privileged action.
- SEO, accessibility and asset fixes in the dashboard app.
- The board refreshes on tab focus and stays current in the background.

## [1.5.0] - 2026-06-22

### Added

- Repository filtering: the pure `applyRepoFilters` with its filter types, the persisted
  `useRepoFilters` hook, and the presentational `RepoFilterBar`, wired into the board with
  an empty state.

### Fixed

- The filter bar uses a search landmark, and visibility chip wiring is covered by tests.

## [1.4.0] - 2026-06-22

### Added

- The toolbar and summary band are frozen in place; the PR dialog is centred.

### Fixed

- nginx proxies over HTTP/1.1 with the correct `Host` header.

## [1.3.1] - 2026-06-19

### Changed

- Release-only: Docker base images digest-pinned and the GHCR package connected to the
  public repository. No library change.

## [1.3.0] - 2026-06-18

Initial public release.

## Earlier releases

1.2.0, 1.1.0, 1.0.0, 0.3.5, 0.3.4, 0.3.3, 0.3.2, 0.3.0, 0.2.1, 0.1.1 and 0.1.0 were
published between 2026-06-05 and 2026-06-18, before this repository was made public. Their
commits are not in this history, so they are recorded here by version and nothing more.

[2.6.1]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.10.0...v2.0.0
[1.10.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.6.1...v1.7.0
[1.6.1]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/FixPortal/fixportal-ci-frontend/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/FixPortal/fixportal-ci-frontend/releases/tag/v1.3.0
