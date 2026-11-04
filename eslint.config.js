import { resolve } from 'node:path';
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CRYPTO_IMPORT_MESSAGE =
  'The Worker must never import the browser-only crypto package (ADR 0004, spec §5).';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.wrangler/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.svelte-kit/**',
      'worker/worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['apps/web/src/**/*.{ts,svelte}', 'apps/web/static/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/web/src/**/*.svelte'],
    rules: {
      // No base path is configured and every navigation is a full page load (ADR 0009), so
      // `resolve()` would add nothing to plain same-origin hrefs.
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}', '**/vite.config.ts', '**/vitest.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },

  // Worker: the server must never be able to touch encryption keys.
  {
    files: ['worker/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@shared/crypto',
                '@shared/crypto/*',
                '**/packages/crypto',
                '**/packages/crypto/**',
              ],
              message: CRYPTO_IMPORT_MESSAGE,
            },
          ],
        },
      ],
    },
  },

  // Worker module boundaries: notes and files are independent; both may use shared/ and env only.
  {
    files: ['worker/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': resolve(import.meta.dirname, 'worker'),
      'boundaries/include': ['src/**/*.ts'],
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
      // Order matters: the first matching descriptor wins, so the catch-all `src` core comes last.
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/shared' },
        { type: 'module', pattern: 'src/modules/*', capture: ['name'] },
        { type: 'core', pattern: 'src' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'core' } },
              allow: { to: { element: { types: ['core', 'shared', 'module'] } } },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { types: ['shared', 'core'] } } },
            },
            {
              from: { element: { type: 'module' } },
              allow: { to: { element: { types: ['shared', 'core'] } } },
            },
            {
              from: { element: { type: 'module' } },
              allow: {
                to: {
                  element: {
                    type: 'module',
                    captured: { name: '{{ from.element.captured.name }}' },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
