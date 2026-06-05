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
    include: ['tests/**/*.test.{ts,tsx}'],
    // Exclude legacy main()-style test files and node-environment tests
    exclude: [
      'tests/engine.test.ts',
      // 'tests/e2e-pipeline.test.ts', // 已取消排除
      // 'tests/kelly-sizing.test.ts', // 已取消排除
      'tests/ws-backfill.test.ts',
      'tests/integration-full-pipeline.test.ts',
      'tests/jvs-e2e-validation.test.ts',
      'tests/jvs-integration.test.ts',
      'tests/jvs-37-ipc-validation.test.ts',
      'tests/paper-trader.test.ts',
      'tests/jvs-50-realtime-quality-monitor.test.ts',
      'tests/jvs-49-data-versioning.test.ts',
      'tests/jvs-100-e2e.test.ts',
      'tests/t53-crypto-service.test.ts',
      'tests/trade-executor.test.ts',
      'tests/trade-executor-ipc.test.ts',
      // 'tests/strategy-execute-integration.test.ts', // 已取消排除
      'tests/q51-chaos-engineering.test.ts',
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
