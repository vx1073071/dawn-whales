// ESLint flat config for ES2022+ TypeScript/React project
// R82: merged from .eslintrc.cjs + .eslintrc.json rules, TypeScript parser added
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'out/**',
      'build/**',
      'coverage/**',
      'temp/**',
      '*.config.*',
      'check_*.js',
      'fix_*.js',
      'debug_*.js',
    ],
  },
  // TypeScript + React files
  {
    files: ['src/**/*.{js,jsx,ts,tsx,mts,mjs}', 'electron/**/*.{js,jsx,ts,tsx,mts,mjs}', 'tests/**/*.{ts,tsx,mts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        // Node
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        exports: 'readonly',
        // ES
        global: 'readonly',
        globalThis: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Date: 'readonly',
        JSON: 'readonly',
        Math: 'readonly',
        Error: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        RegExp: 'readonly',
        Symbol: 'readonly',
        // React JSX
        React: 'readonly',
        JSX: 'readonly',
        // Testing
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        vitest: 'readonly',
        // Electron
        Electron: 'readonly',
        __non_webpack_require__: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // --- Core ESLint (error level) ---
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-template-curly-in-string': 'warn',
      'no-duplicate-imports': 'warn',

      // --- Core ESLint (warn level) ---
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // --- TypeScript rules ---
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // --- React rules ---
      'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
      'react/prop-types': 'off',         // TypeScript replaces PropTypes
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-danger': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/no-unknown-property': 'error',
    },
  },
  // Plain JS files (scripts, configs) — no TypeScript parser
  {
    files: ['*.js', '*.cjs', '*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-unused-vars': 'warn',
    },
  },
];
