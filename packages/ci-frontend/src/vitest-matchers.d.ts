import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

// @testing-library/jest-dom 7.0.1 augments `Assertion<T = any>`, the shape Vitest
// exposed up to 4.x. Vitest 5 widened it to `Assertion<R, T>`, so that augmentation
// no longer merges and every `toBeInTheDocument` / `toHaveAttribute` call fails
// typecheck with TS2339 while passing at runtime (the matchers are still registered
// by `@testing-library/jest-dom/vitest` in test/setup.ts).
//
// `Matchers<R, T>` is Vitest 5's documented extension point and is what jest-dom
// will target once it supports v5. Declare it here until then; the type parameters
// must match Vitest's own declaration exactly or the interfaces will not merge.
declare module 'vitest' {
  /* eslint-disable-next-line @typescript-eslint/no-empty-object-type --
     an empty body is the whole mechanism: this merges the matchers into Vitest's
     interface, and adding a member would change the interface rather than extend it. */
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<T, R> {}
}
