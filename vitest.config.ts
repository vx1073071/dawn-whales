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
      // [R92] Only 3 truly unfixable files remain (target: exclude ≤3)
      'tests/q35-trading-components.test.tsx',     // #92-01: requires @testing-library/react (not installed, major refactor needed)
      'tests/benchmark-engines.test.ts',           // #92-02: hangs vitest runner (1429L heavy benchmark, needs vitest.node.config migration)
      'tests/ws-backfill.test.ts',                 // #92-03: requires live WS server (external dependency, not mockable)
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
