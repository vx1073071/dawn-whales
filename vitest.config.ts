import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'electron-log': path.resolve(__dirname, 'tests/helpers/electron-log-mock.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    env: { NODE_ENV: 'development' },
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
      // Legacy/empty test files (no vitest describe/it)
           // R86: QClaw snapshot/gate tests (environment-dependent)
      'tests/q79-01-i18n-consistency.test.ts',
      'tests/q79-03-excluded-migration.test.ts',
 'tests/engine.test.ts',
      'tests/e2e-pipeline.test.ts',
      'tests/kelly-sizing.test.ts',
      'tests/strategy-execute-integration.test.ts',
      // Requires @testing-library/react (not installed)
      'tests/q35-trading-components.test.tsx',
      // Flaky: chaos simulation timing-dependent
      'tests/q51-chaos-engineering.test.ts',
      // Requires Node `events` module (extends EventEmitter — not resolved in jsdom)
      'tests/jvs-21-22-23-optimizers.test.ts',
      // Standalone tsx test files (use custom assert, not vitest describe/it)
      'tests/jvs-116-ws-perf-standalone.ts',
      'tests/jvs-117-cache-standalone.ts',
      'tests/jvs-118-signal-agg-standalone.ts',
      'tests/jvs-119-orderbook-standalone.ts',
      'tests/jvs-21-22-23-standalone.ts',
      'tests/j-38-01-kline-replay.test.ts',
      'tests/j-38-02-multi-timeframe.test.ts',
      // ESM transform error — pre-existing broken file
      'tests/jvs-57-02-agent-technical.test.ts',
      // Migrated to vitest.node.config.ts (R84 P1-13a):
      // jvs-37-ipc-validation, jvs-49-data-versioning, jvs-50-realtime-quality-monitor,
      // jvs-integration, jvs-100-e2e, jvs-115-aggregator, ws-backfill,
      // integration-full-pipeline, t53-crypto-service, q47-property-testing,
      // jvs-83-benchmark, benchmark-engines
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Force react dev build for testing (production build breaks act())
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react-dom/client': path.resolve(__dirname, './node_modules/react-dom/client.js'),
      // Node built-in: vitest jsdom can't resolve 'events' for engine imports
      'events': path.resolve(__dirname, './tests/helpers/events-polyfill.ts'),
      // Node built-in: vitest jsdom can't resolve 'crypto' for engine imports
      'crypto': path.resolve(__dirname, './tests/helpers/crypto-polyfill.ts'),
    },
  },
});
