import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    env: { NODE_ENV: 'development' },
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
      // PM fixed: EventEmitter now in globalThis via setup file (tests/helpers/setup.ts)
      // 'tests/closed-loop-executor.test.ts',
      // 'tests/closed-loop-integration.test.ts',
      // 'tests/position-monitor.test.ts',
      // 'tests/rebalance-engine.test.ts',
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
    },
  },
});
