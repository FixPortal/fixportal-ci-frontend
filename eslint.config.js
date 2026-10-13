import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'

// House bans, shared with scaffold-typescript. Each carries its WHY; a silenced rule
// with no rationale rots.
const noEnum = {
  selector: 'TSEnumDeclaration',
  message: 'No enums (erasable syntax only). Use a const object plus a union type.',
}
const noDefaultExport = {
  selector: 'ExportDefaultDeclaration',
  message: 'Named exports only: default exports rename silently and defeat find-references.',
}
const noBareNewDate = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message: 'Do not read the clock directly. Take a Clock (src/**/clock.ts) as a parameter.',
}

export default defineConfig([
  globalIgnores(['**/dist', '**/coverage', '**/node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Full SonarJS recommended set (cognitive complexity + bug/code-smell rules).
      // Severities are downgraded to 'warn' below — advisory, never build-breaking.
      sonarjs.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      // Type-aware linting. Every .ts/.tsx matched here must belong to a tsconfig; a file
      // in no project fails with "was not found by the project service".
      parserOptions: {
        projectService: {
          // Tool config files sit outside every tsconfig on purpose: adding vite.config.ts
          // to a project pulls @types/node into src, which turns the `@ts-expect-error`
          // directives that probe missing Node typings into "unused directive" errors
          // (observed: fonts.test.ts, board.css.test.ts, backendContract.contract.ts).
          allowDefaultProject: [
            'apps/dashboard/*.config.ts',
            'packages/ci-frontend/*.config.ts',
            'packages/ci-frontend/test/setup.ts',
            'playwright.config.ts',
            'test/package-consumer/vite.config.ts',
          ],
          defaultProject: 'tsconfig.tooling.json',
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 12,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Every SonarJS rule from the recommended set runs as a warning, not an error,
      // so findings surface in the editor and CI logs without failing `eslint .`.
      ...Object.fromEntries(
        Object.keys(sonarjs.configs.recommended.rules ?? {}).map((name) => [name, 'warn']),
      ),
      // Silence SonarJS rules that are stylistic policy or false-positive noise here.
      'sonarjs/file-header': 'off',
      'sonarjs/arrow-function-convention': 'off',
      'sonarjs/declarations-in-global-scope': 'off',
      'sonarjs/cyclomatic-complexity': 'off',
      'sonarjs/no-reference-error': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // strictTypeChecked rejects every number in a template literal. Counts, indexes and
      // durations in labels and error text are the whole use here (47 hits, none a bug);
      // objects, undefined and null still fail, which is the class the rule exists for.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Not in strictTypeChecked; a missing union case must fail the gate, not slip past at
      // runtime. Type-aware, so it lives ONLY in this typed block.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Do not read the clock directly. Take a Clock (src/**/clock.ts) as a parameter.',
        },
      ],
      'no-restricted-syntax': ['error', noEnum, noDefaultExport, noBareNewDate],
    },
  },
  {
    // The single boundary file that may call a bare new Date().
    files: ['src/**/clock.{ts,tsx}', 'packages/*/src/**/clock.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', noEnum, noDefaultExport] },
  },
  {
    // Context modules pair a Provider with the hook that reads it. Since
    // eslint-plugin-react-refresh 0.5.6 recognises `export const P = Ctx.Provider`
    // as a component export, which turns the paired hook into a violation. Splitting
    // the hook out does not help: it needs the context object, so the context file
    // would then export a non-component instead. Name the hooks rather than move them.
    files: [
      'packages/ci-frontend/src/CiAdminContext.tsx',
      'packages/ci-frontend/src/CiConfigContext.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': [
        'error',
        // allowConstantExport is restated because this entry replaces the one
        // reactRefresh.configs.vite sets, rather than merging with it.
        { allowConstantExport: true, allowExportNames: ['useCiAdmin', 'useCiConfig'] },
      ],
    },
  },
  {
    // Test files have different conventions from library code: repeated literals
    // are readable fixtures, passing `undefined` exercises missing-prop paths,
    // and render-helper components trip name rules that only fit shipped code.
    files: [
      '**/*.{test,spec}.{ts,tsx}',
      'packages/ci-frontend/test/**/*.ts',
      'e2e/host/**/*.{ts,tsx}',
    ],
    rules: {
      // Tests assert presence (expect(...).not.toBeNull(), a prior render check) before they
      // read a value, and noUncheckedIndexedAccess makes every fixture[0] possibly undefined.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Fake fetchers and resolvers must return a Promise to match the real signature.
      '@typescript-eslint/require-await': 'off',
      // No-op stubs: jsdom polyfills (matchMedia, ResizeObserver) and mock callbacks.
      '@typescript-eslint/no-empty-function': 'off',
      // A sleep followed by an assert encodes a timing assumption a contended runner
      // will not honour. Use vi.useFakeTimers() or await a real completion signal.
      // This catches bare setTimeout(...) only; window./globalThis.setTimeout is review-only.
      'no-restricted-globals': [
        'error',
        {
          name: 'setTimeout',
          message: 'Use vi.useFakeTimers() or await a real completion signal.',
        },
      ],
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-undefined-assignment': 'off',
      'sonarjs/no-wildcard-import': 'off',
      'sonarjs/function-name': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/no-implicit-dependencies': 'off',
    },
  },
  {
    // These test files read files through node:fs / node:path / node:module, which the
    // browser-facing projects deliberately leave untyped (no @types/node; each carries a
    // @ts-expect-error saying so). The imports therefore resolve to ny, and every use
    // of them reports no-unsafe-*.
    files: [
      'apps/dashboard/src/fonts.test.ts',
      'packages/ci-frontend/src/styles/board.css.test.ts',
      'packages/ci-frontend/src/api/backendContract.contract.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // @vitejs/plugin-react is installed only into the consumer fixture by
    // scripts/package-smoke.mjs, never into the workspace, so the import does not resolve
    // here and the plugin call reports as unsafe.
    files: ['test/package-consumer/**/*.ts'],
    rules: { '@typescript-eslint/no-unsafe-call': 'off' },
  },
  {
    // Playwright specs run against a real browser and the real clock; there is no Clock to
    // inject into a fixture timestamp. The enum and default-export bans still apply.
    files: ['e2e/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', noEnum, noDefaultExport] },
  },
  {
    // Only the default-export ban is relaxed here: tool config files (vite.config.ts,
    // vitest.config.ts, playwright.config.ts) must default-export. The enum and bare
    // new Date() bans still apply. Declared last so it wins over the blocks above.
    files: ['**/*.config.ts'],
    rules: { 'no-restricted-syntax': ['error', noEnum, noBareNewDate] },
  },
])
