# Changelog

All notable changes to `@fix-portal/ci-frontend` are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries begin at 3.0.0. Earlier history is deliberately not backfilled: it was removed
at the first public cut, which marks where changelog discipline starts rather than
making a claim about what came before. `npm view @fix-portal/ci-frontend versions`
lists every published release.

## [Unreleased]

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
