/**
 * ArchUnitTS architecture spec (https://github.com/LukasNiessen/ArchUnitTS).
 *
 * File/folder-level architecture rules for the @fix-portal/ci-frontend React
 * library. The real dependency layering, derived from the import graph, is
 * (low -> high):
 *
 *   api/types.ts        pure type definitions; depends on nothing internal
 *     |- api/*          snapshot fetch; depends only on api/types
 *     |- lib/*          pure helpers; depend only on api/types (+ sibling lib)
 *     |- *Context.tsx   React context; depend only on api/types
 *        |- hooks/*     depend on api + contexts
 *        |- components/* depend on api + lib ONLY (no hooks, no contexts, no pages)
 *           |- pages/*  composition layer; wires hooks + contexts + components
 *              |- CiBoard.tsx (root) -> index.ts (public barrel)
 *
 * Scope: the high-value, hard-to-eyeball invariants only -- layer isolation and
 * cycle freedom. Two non-obvious ones worth locking in:
 *   - components are PRESENTATIONAL: they never import hooks or contexts; the
 *     page owns all stateful wiring and passes data down as props.
 *   - lib stays PURE: no UI, no hooks -- only api/types.
 * (Naming and size-metric rules were trialled and dropped: naming overlaps
 * existing convention, and ArchUnitTS's metrics are class-oriented, of little
 * use in a function-component codebase.)
 *
 * Assertion style: we call `.check()` (every condition implements Checkable) and
 * assert on the returned Violation[] with plain `expect`. ArchUnitTS's
 * `toPassAsync` matcher only auto-registers under Vitest `globals: true`, which
 * this project intentionally opts out of (see vitest.config.ts + test/setup.ts).
 * The fluent entrypoint (`projectFiles`) is imported through a single local
 * wrapper, `./architecture.archunit`, which isolates the dist-internal deep
 * import and the exact-version pin it requires -- see that file's header for the
 * full rationale and the upgrade path.
 */
import { describe, it, expect } from 'vitest'
import { projectFiles } from './architecture.archunit'

// Vitest runs with cwd = packages/ci-frontend, so this resolves to the lib's own
// tsconfig (include: ["src"]).
const TS_CONFIG = 'tsconfig.json'

// Test files legitimately reach across layers (a component test imports the
// component under test, a provider, etc.), so layering rules exclude them.
const EXCEPT_TESTS = { except: { withName: '*.test.*' } }

// Each row asserts: nothing in `from` may depend on `to`. Data-driven so the
// matrix of invariants stays readable and easy to extend.
const FORBIDDEN_EDGES: ReadonlyArray<{ from: string; fromGlob: string; to: string; toGlob: string }> = [
  // api is the bottom layer: it knows nothing above it.
  { from: 'api', fromGlob: '**/api/**', to: 'lib', toGlob: '**/lib/**' },
  { from: 'api', fromGlob: '**/api/**', to: 'hooks', toGlob: '**/hooks/**' },
  { from: 'api', fromGlob: '**/api/**', to: 'components', toGlob: '**/components/**' },
  { from: 'api', fromGlob: '**/api/**', to: 'pages', toGlob: '**/pages/**' },
  // lib stays pure: helpers must not reach into UI or stateful layers.
  { from: 'lib', fromGlob: '**/lib/**', to: 'hooks', toGlob: '**/hooks/**' },
  { from: 'lib', fromGlob: '**/lib/**', to: 'components', toGlob: '**/components/**' },
  { from: 'lib', fromGlob: '**/lib/**', to: 'pages', toGlob: '**/pages/**' },
  // hooks sit below the UI: they must not depend on components or pages.
  { from: 'hooks', fromGlob: '**/hooks/**', to: 'components', toGlob: '**/components/**' },
  { from: 'hooks', fromGlob: '**/hooks/**', to: 'pages', toGlob: '**/pages/**' },
  // components are presentational: no hooks, no pages.
  { from: 'components', fromGlob: '**/components/**', to: 'hooks', toGlob: '**/hooks/**' },
  { from: 'components', fromGlob: '**/components/**', to: 'pages', toGlob: '**/pages/**' },
]

describe('architecture / layer isolation', () => {
  for (const edge of FORBIDDEN_EDGES) {
    it(`${edge.from} must not depend on ${edge.to}`, async () => {
      const violations = await projectFiles(TS_CONFIG)
        .inFolder(edge.fromGlob, EXCEPT_TESTS)
        .shouldNot()
        .dependOnFiles()
        .inFolder(edge.toGlob)
        .check()
      expect(violations).toEqual([])
    })
  }

  // components are context-free: only pages/hooks may touch the React contexts.
  // The contexts live at src root (CiAdminContext.tsx / CiConfigContext.tsx), so
  // this targets them by filename rather than folder.
  it('components must not depend on React contexts', async () => {
    const violations = await projectFiles(TS_CONFIG)
      .inFolder('**/components/**', EXCEPT_TESTS)
      .shouldNot()
      .dependOnFiles()
      .withName('*Context.tsx')
      .check()
    expect(violations).toEqual([])
  })
})

describe('architecture / cycles', () => {
  it('the whole src tree is free of import cycles', async () => {
    const violations = await projectFiles(TS_CONFIG)
      .inFolder('**/src/**')
      .should()
      .haveNoCycles()
      .check()
    expect(violations).toEqual([])
  })
})
