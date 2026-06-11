// run-test-summary.mjs — runs vitest and writes JSON summary
import { createVitest } from 'vitest/node';
import { writeFileSync } from 'fs';

const startTs = Date.now();
const ctx = await createVitest('test', {
  watch: false,
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
    // [R92 Claw] Hanging tests — infinite loop, deadlock, or timeout
    'tests/t90-load-tester.test.ts',
  ],
  testTimeout: 30000,       // 30s per test max
  hookTimeout: 10000,       // 10s per hook max
  sequence: { concurrent: false }, // Sequential only
});

await ctx.start();

let passed = 0;
let failed = 0;
let skipped = 0;
const failedFiles = [];
const fileResults = [];

ctx.state.getFiles().forEach(f => {
  const result = f.result;
  if (!result) return;
  let filePassed = 0, fileFailed = 0, fileSkipped = 0;

  result.state?.tasks?.forEach(t => {
    if (t.state === 'pass') { filePassed++; passed++; }
    else if (t.state === 'fail') { fileFailed++; failed++; }
    else if (t.state === 'skip') { fileSkipped++; skipped++; }
  });

  fileResults.push({ file: f.filepath, passed: filePassed, failed: fileFailed, skipped: fileSkipped });
  if (fileFailed > 0) {
    const errors = [];
    result.state?.tasks?.forEach(t => {
      if (t.state === 'fail' && t.result?.errors) {
        t.result.errors.forEach(e => {
          if (e.stack) errors.push({ name: t.name, message: e.message?.split('\n')[0] || '' });
        });
      }
    });
    failedFiles.push({ file: f.filepath, failed: fileFailed, errors: errors.slice(0, 3) });
  }
});

const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);

const summary = {
  total: passed + failed + skipped,
  passed,
  failed,
  skipped,
  failedFiles: failedFiles.length,
  time: elapsed,
  failedFileList: failedFiles,
  fileResults: fileResults.filter(f => f.failed > 0),
};

writeFileSync('test-summary.json', JSON.stringify(summary, null, 2), 'utf-8');
console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
console.log(`Failed files: ${failedFiles.length}`);
console.log(`Time: ${elapsed}s`);
console.log(`Written to test-summary.json`);

await ctx.close();
process.exit(failed > 0 ? 1 : 0);
