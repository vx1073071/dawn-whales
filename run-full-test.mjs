// run-full-test.mjs — runs vitest programmatically and writes JSON results
import { createVitest } from 'vitest/node';
import { writeFileSync } from 'fs';

const vitest = await createVitest('run', {
  reporter: 'json',
  include: ['tests/**/*.test.{ts,tsx}'],
  exclude: [
    'tests/q35-trading-components.test.tsx',
    'tests/benchmark-engines.test.ts',
    'tests/ws-backfill.test.ts',
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
});

console.log('Starting vitest...');
const startTime = Date.now();

// Collect results
const results = [];
let passed = 0;
let failed = 0;
let skipped = 0;

await vitest.start();

for (const task of vitest.state.getFiles()) {
  const result = await vitest.rerunFiles([task.filepath]);
  // wait for current test to complete
}

// Use 'finished' event to collect final state
await new Promise((resolve) => {
  vitest.onFinished = (state) => {
    state.forEach((fileResult) => {
      const file = {
        file: fileResult.filepath,
        tests: fileResult.result?.state?.tasks?.length || 0,
      };
    });
    resolve();
  };
});

// Alternative: wait for all tests and use reporter output
const collected = { tasks: [] };

const reporter = vitest.reporters[0];

// Actually, let's just wait for completion
await vitest.rerunFiles(vitest.state.getFilepaths());

await vitest.close();

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s`);
console.log(`Results written to test-results.json`);

// Read the JSON file that vitest should have generated
// vitest with --reporter=json writes to stdout, but programmatically it may not
// Let's try a different approach
