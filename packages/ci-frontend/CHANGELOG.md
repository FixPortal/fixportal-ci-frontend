# Changelog

All notable changes to `@fix-portal/ci-frontend` are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries begin at 3.0.0. Earlier history is deliberately not backfilled: it was removed
at the first public cut, which marks where changelog discipline starts rather than
making a claim about what came before. `npm view @fix-portal/ci-frontend versions`
lists every published release.

## [Unreleased]

## [3.3.0] - 2026-09-03

### Changed

- Merging now confirms in the control itself. The `Ready to merge` pill and `Merge all` take
  two clicks: the first arms the button and relabels it, the second performs the merge. An
  armed button stands down on blur, and on its own after five seconds. Hosts that wrapped
  `mergeFetcher` in `window.confirm()` should drop that dialog: a browser-suppressed
  `confirm()` returns false with nothing shown, which reached the board as an ordinary merge
  failure and was indistinguishable from one GitHub refused.

## [3.2.0] - 2026-09-02

### Added

- `CiBoard` accepts a controlled `theme?: 'light' | 'dark'` prop. When set, the board writes
  `data-theme` onto its own `.ci-page` container and the internal theme switcher (with its
  localStorage persistence) stays unmounted, so an embedded host shell owns the mode with a
  single writer. Absent prop keeps the previous uncontrolled behaviour unchanged.

## [3.1.3] - 2026-08-31

### Fixed

- `button.chip` no longer strips border, background, and padding from chips rendered as a
  `<button>` (e.g. the `Merge all` pill), which previously rendered as bare unstyled text.

## [3.1.2] - 2026-08-29

### Fixed

- A merge in progress no longer disables merge controls board-wide: only the pill being
  merged (and, during `Merge all`, the rest of that repository's ready pills) stands down,
  so merges in other repositories can be started while one is in flight.
- Merge failures are retained per repository, so a second failure elsewhere on the board no
  longer replaces the first.
- Opening the pull-request stepper on a repository whose merge has just failed keeps that
  error on screen instead of clearing it.

## [3.1.1] - 2026-08-28

### Fixed

- Successful single and batch merges immediately reconcile the open-PR count, filters, summary, and merge pills while the backend snapshot catches up.
- Merge controls keep an explicit in-progress state, show a short merged receipt, release their busy guard when host callbacks throw, and bound retained merge state.
- Display-only Ready-to-merge pills retain their original tooltip while merged receipts remain visible to non-admin viewers.

## [3.1.0] - 2026-08-26

### Added

- Admin hosts can supply `mergeFetcher` to rebase-merge ready pull requests without exposing server credentials to the browser.
- Ready pull requests render as actionable merge pills for admins, with per-repository `Merge all` when at least two are ready.

### Changed

- The vendored dark `--warn-text` token is re-synced to the shared design source (`#fcd34d`).

### Fixed

- Merge failures remain scoped to their repository, refresh stale snapshots, and never throw on malformed responses.
- The design-token drift check now verifies both explicit-dark and OS-dark blocks.

## [3.0.0]

**No library change.** Relative to 2.7.0 this release alters nothing under
`packages/ci-frontend/src`: the whole diff is the removed changelog, one README line,
and the version itself. It carries no breaking change and needs no migration - the
major was cut alongside the repository going public, not to signal an API break.
Recorded because a published major with no entry reads as a migration a consumer has
to go and find.
