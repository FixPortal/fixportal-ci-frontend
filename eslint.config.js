import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'

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
    },
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
    files: ['**/*.{test,spec}.{ts,tsx}', 'e2e/host/**/*.{ts,tsx}'],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-undefined-assignment': 'off',
      'sonarjs/no-wildcard-import': 'off',
      'sonarjs/function-name': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/no-implicit-dependencies': 'off',
    },
  },
])
