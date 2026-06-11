/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * OOM-Safe Vitest Configuration
 * 
 * Key changes to prevent OOM kills:
 * 1. fileParallelism: false — run test files sequentially
 * 2. maxConcurrency: 1 — one test at a time
 * 3. isolate: true — each test file gets fresh memory
 * 4. pool: 'forks' — uses child_process.fork (better memory isolation than threads)
 * 5. poolOptions.forks.singleFork: true — reuse single fork (avoids spawning overhead)
 * 6. Increased timeout to 300s for sequential runs
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx,js}', 'electron/**/*.test.{ts,tsx,js}', 'src/**/*.test.{ts,tsx,js}'],
    exclude: ['node_modules', 'dist', '**/*.standalone.ts'],
    // OOM prevention
    fileParallelism: false,       // Sequential file execution
    maxConcurrency: 1,            // One test at a time within a file
    isolate: true,                // Fresh context per file
    pool: 'forks',                // Better memory isolation
    poolOptions: {
      forks: {
        singleFork: true,         // Reuse single child process
      },
    },
    // Timeouts
    testTimeout: 300000,          // 5 min per test (was 3 min)
    hookTimeout: 120000,
    teardownTimeout: 30000,
    // Reporting
    reporters: ['verbose'],
    // Coverage (off by default — enable separately)
    coverage: {
      enabled: false,
    },
  },
});
