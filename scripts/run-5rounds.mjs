/**
 * Q-01: 5-Round Regression CI (v3 - file-based output capture)
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';

const ROUNDS = 5;
const results = [];
const tmpFile = 'vitest-output.tmp';

for (let i = 1; i <= ROUNDS; i++) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Round ${i}/${ROUNDS} — ${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(60));

  const start = Date.now();
  try {
    // Write output to temp file to capture properly
    execSync(
      `node --no-warnings node_modules/vitest/vitest.mjs run 2>&1 | Out-File -FilePath ${tmpFile} -Encoding UTF8`,
      { cwd: process.cwd(), encoding: 'utf-8', timeout: 180000, shell: 'powershell.exe' }
    );
  } catch { /* ignore exit code */ }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  let out = '';
  try { out = readFileSync(tmpFile, 'utf-8'); } catch { out = ''; }

  // Parse vitest 4.x output with ANSI codes stripped
  const clean = out.replace(/\x1b\[[0-9;]*m/g, '');

  // "Tests   4991 passed | 17 skipped (5008)"
  const testsMatch = clean.match(/Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s*skipped)?/);
  const passed = testsMatch ? parseInt(testsMatch[1]) : 0;
  const skipped = testsMatch ? parseInt(testsMatch[2] || 0) : 0;

  const failMatch = clean.match(/(\d+)\s+failed/);
  const failed = failMatch ? parseInt(failMatch[1]) : 0;

  const errorMatch = clean.match(/(\d+)\s+errors?/);
  const errors = errorMatch ? parseInt(errorMatch[1]) : 0;

  // Get failed test names
  const failTests = [];
  const lines = clean.split('\n');
  for (const line of lines) {
    const m = line.match(/FAIL\s+tests\/([^\s\[]+)/);
    if (m && !failTests.includes(m[1])) failTests.push(m[1]);
  }

  // Test Files line
  const filesMatch = clean.match(/Test Files\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?(?:\s*\|\s*(\d+)\s+skipped)?/);
  const filesPassed = filesMatch ? parseInt(filesMatch[1]) : 0;
  const filesFailed = filesMatch ? parseInt(filesMatch[2] || 0) : 0;

  const result = {
    round: i, passed, failed, skipped, errors, elapsed: parseFloat(elapsed),
    failTests, filesPassed, filesFailed,
    status: failed === 0 && errors === 0 ? 'GREEN' : 'RED'
  };
  results.push(result);
  console.log(`Round ${i}: ${result.status} — ${passed} passed, ${failed} failed, ${skipped} skipped, ${filesFailed} failed files, ${elapsed}s`);
  if (failTests.length > 0) console.log(`  Failed: ${failTests.join(', ')}`);
}

// Cleanup
try { unlinkSync(tmpFile); } catch {}

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log('5-ROUND REGRESSION SUMMARY');
console.log('='.repeat(60));

const greenCount = results.filter(r => r.status === 'GREEN').length;
const allPassed = results.map(r => r.passed);
const maxPassed = Math.max(...allPassed);
const minPassed = Math.min(...allPassed);

// Flaky detection
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

console.log('\nResults:');
results.forEach(r => {
  console.log(`  Round ${r.round}: ${r.status} | ${r.passed} pass | ${r.failed} fail | ${r.skipped} skip | ${r.filesFailed} fail-files | ${r.elapsed}s`);
});

console.log(`\nMetrics:`);
console.log(`  Green rounds: ${greenCount}/5`);
console.log(`  Passed range: ${minPassed} - ${maxPassed} (variance: ${maxPassed - minPassed})`);
console.log(`  Flaky test files: ${flakyTests.length}`);
if (flakyTests.length > 0) {
  flakyTests.forEach(f => console.log(`    ${f.test}: ${f.passCount} pass / ${f.failCount} fail`));
}

const verdict = greenCount === 5 && flakyTests.length === 0 ? 'PASS' : 'NEEDS_INVESTIGATION';
console.log(`\nVerdict: ${verdict}`);

const report = { results, greenCount, flakyRate: flakyTests.length, flakyTests, verdict, timestamp: new Date().toISOString() };
writeFileSync('test-results-5round.json', JSON.stringify(report, null, 2));
console.log('Saved: test-results-5round.json');
