import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest Node Environment Config
 * R84 P1-13a — dedicated config for IPC/native/Node-dependent tests
 *
 * Tests that require:
 * - Electron IPC (ipcMain, ipcRenderer)
 * - better-sqlite3 native module
 * - WebSocket server singletons
 * - crypto wallet integration
 * - node:child_process / node:worker_threads
 * - Benchmark/stress tests with real timing
 *
 * Run: npx vitest --config vitest.node.config.ts
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // Node env allows all built-ins (events, crypto, path, fs, etc.)
    include: [
      // IPC/Electron-native tests (8)
      'tests/jvs-37-ipc-validation.test.ts',
      'tests/jvs-49-data-versioning.test.ts',
      'tests/jvs-50-realtime-quality-monitor.test.ts',
      'tests/jvs-integration.test.ts',
      'tests/jvs-100-e2e.test.ts',
      'tests/jvs-115-aggregator.test.ts',
      'tests/ws-backfill.test.ts',
      'tests/integration-full-pipeline.test.ts',
      // Crypto/native-dependent tests (2)
      'tests/t53-crypto-service.test.ts',
      'tests/q47-property-testing.test.ts',
      // Benchmark/stress tests (2) — real timing acceptable in Node env
      'tests/jvs-83-benchmark.test.ts',
      'tests/benchmark-engines.test.ts',
    ],
    // Empty exclude in Node config — we explicitly include what we want
    exclude: [],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Node env doesn't need polyfills — built-ins resolve natively
    },
  },
});
