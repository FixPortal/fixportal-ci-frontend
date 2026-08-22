# Changelog

All notable changes to `@fix-portal/ci-frontend` are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries begin at 3.0.0. Earlier history is deliberately not backfilled: it was removed
at the first public cut, which marks where changelog discipline starts rather than
making a claim about what came before. `npm view @fix-portal/ci-frontend versions`
lists every published release.

## [Unreleased]

### Changed

- The vendored dark `--warn-text` token is re-synced to the shared design source
  (`#fcd34d`). It had been pinned at the retired `#f0abfc` by an entry in the drift
  checker's override list, so the checker reported a match while the board rendered a
  colour the source no longer ships.

### Fixed

- The design-token drift check now reads both dark blocks in the vendored sheet - the
  `[data-theme="dark"]` toggle and the `@media (prefers-color-scheme: dark)` block -
  and asserts they agree. Only the first was read, so the OS-preference path, which is
  the default for any viewer who never toggled a theme, sat outside the detector whose
  purpose is catching exactly that drift.

## [3.0.0]

**No library change.** Relative to 2.7.0 this release alters nothing under
`packages/ci-frontend/src`: the whole diff is the removed changelog, one README line,
and the version itself. It carries no breaking change and needs no migration - the
major was cut alongside the repository going public, not to signal an API break.
Recorded because a published major with no entry reads as a migration a consumer has
to go and find.
