import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
      'tests/engine.test.ts',
      // No top-level describe/test — these files exist but are empty
      'tests/e2e-pipeline.test.ts',
      'tests/kelly-sizing.test.ts',
      'tests/strategy-execute-integration.test.ts',
      // Standalone tsx script (imports electron-log, native path — breaks in jsdom)
      'tests/integration-full-pipeline.test.ts',
      // Electron IPC mock required — jsdom cannot run ipcMain
      'tests/jvs-37-ipc-validation.test.ts',
      // Requires better-sqlite3 native module (ERR_DLOPEN_FAILED in vitest jsdom)
      'tests/jvs-49-data-versioning.test.ts',
      // Requires electron IPC mock (ipcMain.handlers in jsdom)
      'tests/jvs-50-realtime-quality-monitor.test.ts',
      'tests/jvs-integration.test.ts',
      // Requires WebSocket mock + electron IPC
      'tests/ws-backfill.test.ts',
      // Requires crypto wallet integration (not available in jsdom)
      'tests/t53-crypto-service.test.ts',
      // Property testing requires node:child_process (not in jsdom)
      'tests/q47-property-testing.test.ts',
      'tests/benchmark-engines.test.ts',
      // Requires @testing-library/react (not installed)
      'tests/q35-trading-components.test.tsx',
      // Requires Electron IPC mock (ipcMain in main process)
      'tests/jvs-100-e2e.test.ts',
      // Requires WebSocket + KLine + Signal pusher singletons (complex deps)
      'tests/jvs-115-aggregator.test.ts',
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
      // Import engine classes with `extends EventEmitter` — now resolved via events-shim.ts
      // All engine tests now pass with the shim!
      // 'tests/closed-loop-executor.test.ts',
      // 'tests/closed-loop-integration.test.ts',
      // 'tests/position-monitor.test.ts',
      // 'tests/rebalance-engine.test.ts',
      // 'tests/condition-trade-bridge.test.ts',
      // 'tests/jvs-36-01-closed-loop-boundary.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['electron/engine/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.*'],
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
    },
  },
});
