import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'electron-log': path.resolve(__dirname, 'tests/helpers/electron-log-mock.ts'),
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react-dom/client': path.resolve(__dirname, './node_modules/react-dom/client.js'),
      'events': path.resolve(__dirname, './tests/helpers/events-polyfill.ts'),
      'crypto': path.resolve(__dirname, './tests/helpers/crypto-polyfill.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    env: { NODE_ENV: 'development' },
    // [R92] OOM fix: single fork = sequential execution, no parallel workers
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // One process at a time — prevents memory explosion
        isolate: false,     // Reuse same context (saves ~50MB per file)
      },
    },
    // Allow Node built-ins (events) to be resolved from engine files
    server: {
      deps: {
        inline: [], // empty = inline nothing, externalize everything
      },
    },
    deps: {
      // Mark Node built-ins as external so vitest doesn't try to bundle them
      external: ['events'],
    },
    // setupFiles removed after test file reorganization (no helpers/mocks.ts)
    setupFiles: ['tests/helpers/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Exclude legacy main()-style test files (no top-level describe/test) and node-environment tests
    exclude: [
      // [R92] 3 unfixable files
      'tests/q35-trading-components.test.tsx',     // requires @testing-library/react
      'tests/benchmark-engines.test.ts',           // hangs vitest runner (heavy benchmark)
      'tests/ws-backfill.test.ts',                 // requires live WS server
      // [R92] Meta-tests: execSync('npx vitest/tsc/build') recursive spawn — causes infinite loop + CMD window spam
      'tests/q51-01-stability-guard.test.ts',
      'tests/q51-02-mutation-testing.test.ts',
      'tests/q52-pre-commit.test.ts',
      'tests/q55-security-scan.test.ts',
      'tests/q60-03-regression.test.ts',
      'tests/q61-03-regression.test.ts',
      'tests/q62-03-regression.test.ts',
      'tests/q63-03-regression.test.ts',
      'tests/q64-03-regression.test.ts',
      'tests/q65-03-regression.test.ts',
      'tests/q66-03-regression.test.ts',
      'tests/q67-01-regression-gate.test.ts',
      'tests/q67-02-build-artifact.test.ts',
      'tests/q68-03-regression-gate.test.ts',
      'tests/q69-01-flaky-fix-5round.test.ts',
      'tests/q71-01-r70-wrapup-ga-final.test.ts',
      'tests/q71-02-regression-gate-5600.test.ts',
      'tests/q75-03-regression-gate-5800.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['electron/engine/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.*'],
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 55,
        statements: 60,
      },
    },
  },
});
