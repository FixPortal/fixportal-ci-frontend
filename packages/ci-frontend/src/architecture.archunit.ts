/**
 * Single chokepoint for ArchUnitTS's fluent entrypoint.
 *
 * Importing the package ROOT (`archunit`) throws at import time under Vitest with
 * `globals: false`: the root module eagerly registers a custom matcher that needs
 * a global `expect`, and we deliberately run without globals (see
 * `vitest.config.ts` + `test/setup.ts`). So we import the fluent API from the
 * package's compiled subpath, which skips that side-effect.
 *
 * That subpath reaches into the package's `dist` internals — `archunit` ships no
 * `exports` map, so `archunit/dist/src/files` is not a supported entrypoint — which
 * is why `archunit` is pinned to an EXACT version in `package.json`. Centralising
 * the deep import here means an `archunit` upgrade touches ONE line, not every
 * architecture spec.
 *
 * On upgrade, re-verify this path. If a future `archunit` release fixes the
 * root-import throw (skip-instead-of-throw) or adds a real `exports` map, collapse
 * this file to the clean form: `export { projectFiles } from 'archunit'` (or
 * `'archunit/files'`), drop the exact version pin, and delete this comment.
 *
 * Background: `docs/archunitts-trial.md` (sharp edges #1 and #2). A cross-vendor
 * adversarial review (2026-06-14) confirmed the upstream fix is a major-version
 * change, not a drive-by patch — hence this local wrapper rather than a fork or PR.
 */
export { projectFiles } from 'archunit/dist/src/files'
