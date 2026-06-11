/**
 * R96 Q-01: 5-Round Regression CI
 */
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const ROUNDS = 5;
const results = [];

for (let i = 1; i <= ROUNDS; i++) {
  console.log(`\nRound ${i}/${ROUNDS}`);
  const start = Date.now();
  try {
    execSync(
      `node --no-warnings node_modules/vitest/vitest.mjs run --exclude='tests/q95-*.test.ts' 2>&1 | Out-File -FilePath vitest-round-${i}.tmp -Encoding UTF8`,
      { cwd: process.cwd(), encoding: 'utf-8', timeout: 180000, shell: 'powershell.exe' }
    );
  } catch {}
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  let out = '';
  try { out = require('fs').readFileSync(`vitest-round-${i}.tmp`, 'utf-8'); } catch {}

  const clean = out.replace(/\x1b\[[0-9;]*m/g, '');
  const testsMatch = clean.match(/Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s*skipped)?/);
  const passed = testsMatch ? parseInt(testsMatch[1]) : 0;
  const skipped = testsMatch ? parseInt(testsMatch[2] || 0) : 0;
  const failMatch = clean.match(/(\d+)\s+failed/);
  const failed = failMatch ? parseInt(failMatch[1]) : 0;
  const filesMatch = clean.match(/Test Files\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?/);
  const filesPassed = filesMatch ? parseInt(filesMatch[1]) : 0;
  const filesFailed = filesMatch ? parseInt(filesMatch[2] || 0) : 0;

  const status = failed === 0 ? 'GREEN' : 'RED';
  results.push({ round: i, passed, failed, skipped, filesPassed, filesFailed, elapsed, status });
  console.log(`  ${status}: ${passed} pass, ${failed} fail, ${filesFailed} fail-files, ${elapsed}s`);
}

console.log(`\n5-Round Summary:`);
results.forEach(r => console.log(`  R${r.round}: ${r.status} | ${r.passed}p ${r.failed}f ${r.skipped}s | ${r.elapsed}s`));

const green = results.filter(r => r.status === 'GREEN').length;
const allPassed = results.map(r => r.passed);
const variance = Math.max(...allPassed) - Math.min(...allPassed);
const flaky = variance > 0 ? 'FLAG ⚠️' : '0';

console.log(`\nGreen: ${green}/5 | Pass variance: ${variance} | Flaky: ${flaky}`);
const verdict = green === 5 && variance === 0 ? 'PASS ✅' : 'NEEDS INVESTIGATION ⚠️';
console.log(`Verdict: ${verdict}`);

writeFileSync('test-results-r96-5round.json', JSON.stringify({ results, greenRounds: green, variance, flaky, verdict }, null, 2));
