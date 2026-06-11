#!/usr/bin/env node
// R95 test runner for engine/data coverage tests
import { startVitest } from 'vitest/node';

const vitest = await startVitest('test', [
  'tests/electron/engine/data/data-formatter.test.ts',
  'tests/electron/engine/data/data-warehouse.test.ts',
  'tests/electron/engine/data/multi-source-aggregator.test.ts',
], {
  run: true,
  reporters: ['verbose'],
});

process.exit(vitest ? 0 : 1);
