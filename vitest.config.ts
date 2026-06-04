import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/helpers/mocks.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Exclude legacy main()-style test files (run via: npm test)
    exclude: [
      'tests/engine.test.ts',
      'tests/e2e-pipeline.test.ts',
      'tests/kelly-sizing.test.ts',
      'tests/ws-backfill.test.ts',
      'tests/integration-full-pipeline.test.ts',
      'tests/jvs-e2e-validation.test.ts',
      'tests/jvs-integration.test.ts',
      'tests/jvs-37-ipc-validation.test.ts',
      'tests/paper-trader.test.ts',
      'tests/jvs-50-realtime-quality-monitor.test.ts',  // EventEmitter mock issue - run separately
      'tests/jvs-49-data-versioning.test.ts',  // better-sqlite3 native bindings - run separately
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
    },
  },
});
