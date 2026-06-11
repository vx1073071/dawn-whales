/**
 * Q-01: 5-Round Regression CI
 * Runs vitest 5 consecutive times, checks for flaky tests.
 */
import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';

const ROUNDS = 5;
const results = [];

for (let i = 1; i <= ROUNDS; i++) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Round ${i}/${ROUNDS} — ${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(60));

  const start = Date.now();
  const nodeBin = 'C:\\Users\\vx107\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe';
  const proc = spawnSync(nodeBin, [
    '--no-warnings',
    'node_modules/vitest/vitest.mjs',
    'run'
  ], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    timeout: 180000,
    env: { ...process.env, NO_COLOR: '1' }
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  // Combine stdout + stderr
  const out = (proc.stdout || '') + '\n' + (proc.stderr || '');

  // Parse: "Tests  5144 passed | 17 skipped (5161)"
  const testsMatch = out.match(/Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s*skipped)?/);
  const passed = testsMatch ? parseInt(testsMatch[1]) : 0;
  const skipped = testsMatch ? parseInt(testsMatch[2] || 0) : 0;

  // Check for failures
  const failMatch = out.match(/(\d+)\s+failed/);
  const failed = failMatch ? parseInt(failMatch[1]) : 0;

  // Check for errors
  const errorMatch = out.match(/(\d+)\s+errors?/);
  const errors = errorMatch ? parseInt(errorMatch[1]) : 0;

  // Get failed test names if any
  const failTests = [];
  const failLines = out.split('\n').filter(l => l.includes('FAIL') && l.includes('tests/'));
  failLines.forEach(l => {
    const m = l.match(/tests\/([^\s>\[]+)/);
    if (m && !failTests.includes(m[1])) failTests.push(m[1]);
  });

  const result = {
    round: i, passed, failed, skipped, errors, elapsed: parseFloat(elapsed),
    failTests,
    status: failed === 0 && errors === 0 ? 'GREEN' : 'RED'
  };
  results.push(result);
  console.log(`Round ${i}: ${result.status} — ${passed} passed, ${failed} failed, ${skipped} skipped, ${errors} errors, ${elapsed}s`);
  if (failTests.length > 0) console.log(`  Failed files: ${failTests.join(', ')}`);
}

// Flaky analysis
console.log(`\n${'='.repeat(60)}`);
console.log('5-ROUND REGRESSION SUMMARY');
console.log('='.repeat(60));

const greenCount = results.filter(r => r.status === 'GREEN').length;
const allPassed = results.map(r => r.passed);
const allFailed = results.map(r => r.failed);
const maxPassed = Math.max(...allPassed);
const minPassed = Math.min(...allPassed);

// Check flaky: if any test file passes in some rounds but fails in others
let flakyTests = [];
const allFailSets = results.map(r => new Set(r.failTests));
const allTestFiles = new Set();
allFailSets.forEach(s => s.forEach(t => allTestFiles.add(t)));
for (const test of allTestFiles) {
  const passCount = allFailSets.filter(s => !s.has(test)).length;
  const failCount = allFailSets.filter(s => s.has(test)).length;
  if (passCount > 0 && failCount > 0) {
    flakyTests.push({ test, passCount, failCount });
  }
}

const flakyRate = flakyTests.length;

console.log(`\nResults:`);
results.forEach(r => {
  console.log(`  Round ${r.round}: ${r.status} | ${r.passed} pass | ${r.failed} fail | ${r.skipped} skip | ${r.errors} err | ${r.elapsed}s`);
});

console.log(`\nMetrics:`);
console.log(`  Green rounds: ${greenCount}/5`);
console.log(`  Passed range: ${minPassed} - ${maxPassed} (variance: ${maxPassed - minPassed})`);
console.log(`  Flaky test files: ${flakyRate}`);
if (flakyTests.length > 0) {
  console.log(`  Flaky details:`);
  flakyTests.forEach(f => console.log(`    ${f.test}: ${f.passCount} pass / ${f.failCount} fail`));
}

const verdict = greenCount === 5 && flakyRate === 0 ? 'PASS' : 'NEEDS_INVESTIGATION';
console.log(`\nVerdict: ${verdict}`);

// Save results
const report = { results, greenCount, flakyRate, flakyTests, verdict, timestamp: new Date().toISOString() };
writeFileSync('test-results-5round.json', JSON.stringify(report, null, 2));
console.log('Results saved to test-results-5round.json');
