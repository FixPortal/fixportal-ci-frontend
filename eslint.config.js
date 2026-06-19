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
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Full SonarJS recommended set (cognitive complexity + bug/code-smell rules).
      // Severities are downgraded to 'warn' below — advisory, never build-breaking.
      sonarjs.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Every SonarJS rule from the recommended set runs as a warning, not an error,
      // so findings surface in the editor and CI logs without failing `eslint .`.
      ...Object.fromEntries(
        Object.keys(sonarjs.configs.recommended.rules ?? {}).map(name => [name, 'warn']),
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
    // Test files have different conventions from library code: repeated literals
    // are readable fixtures, passing `undefined` exercises missing-prop paths,
    // and render-helper components trip name rules that only fit shipped code.
    files: ['**/*.{test,spec}.{ts,tsx}'],
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
