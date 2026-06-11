/**
 * Q-03: Coverage Sprint
 * Target: statements≥65%, branches≥45%, functions≥55%
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';

console.log('Q-03: Coverage Sprint');
console.log('='.repeat(60));
console.log(`Running vitest with coverage...`);

const start = Date.now();
let output = '';
try {
  output = execSync(
    'node --no-warnings node_modules/vitest/vitest.mjs run --coverage --coverage.reporter=text --coverage.reporter=json',
    { cwd: process.cwd(), encoding: 'utf-8', timeout: 300000, env: { ...process.env, NO_COLOR: '1' } }
  );
} catch (e) {
  output = (e.stdout || '') + '\n' + (e.stderr || '');
}
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`\nCoverage run completed in ${elapsed}s`);

// Parse coverage output
const coverageData = {
  statements: { pct: 0, covered: 0, total: 0 },
  branches: { pct: 0, covered: 0, total: 0 },
  functions: { pct: 0, covered: 0, total: 0 },
  lines: { pct: 0, covered: 0, total: 0 }
};

// Look for summary table
// Pattern: "% Stmts   % Branch   % Funcs   % Lines"
const summaryMatch = output.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
if (summaryMatch) {
  coverageData.statements.pct = parseFloat(summaryMatch[1]);
  coverageData.branches.pct = parseFloat(summaryMatch[2]);
  coverageData.functions.pct = parseFloat(summaryMatch[3]);
  coverageData.lines.pct = parseFloat(summaryMatch[4]);
}

// Also try to read coverage-summary.json if available
const summaryPath = 'coverage/coverage-summary.json';
if (existsSync(summaryPath)) {
  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    const total = summary.total;
    if (total) {
      coverageData.statements = { pct: total.statements.pct, covered: total.statements.covered, total: total.statements.total };
      coverageData.branches = { pct: total.branches.pct, covered: total.branches.covered, total: total.branches.total };
      coverageData.functions = { pct: total.functions.pct, covered: total.functions.covered, total: total.functions.total };
      coverageData.lines = { pct: total.lines.pct, covered: total.lines.covered, total: total.lines.total };
    }
  } catch { /* ignore */ }
}

// Targets
const targets = { statements: 65, branches: 45, functions: 55, lines: 60 };

console.log('\n' + '='.repeat(60));
console.log('COVERAGE RESULTS');
console.log('='.repeat(60));
console.log('');
console.log('  Category     | Actual  | Target  | Status');
console.log('  -------------|---------|---------|-------');
for (const [key, target] of Object.entries(targets)) {
  const actual = coverageData[key]?.pct || 0;
  const status = actual >= target ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${key.padEnd(12)} | ${actual.toFixed(1).padStart(6)}% | ${target.toString().padStart(6)}% | ${status}`);
}

const allPass = Object.entries(targets).every(([key, target]) => (coverageData[key]?.pct || 0) >= target);
const verdict = allPass ? 'PASS ✅' : 'NEEDS IMPROVEMENT ⚠️';
console.log(`\n  Verdict: ${verdict}`);

// Identify low-coverage files
console.log('\n  Low-coverage files (< 40% statements):');
const lowCovFiles = [];
const fileLines = output.split('\n');
for (const line of fileLines) {
  const m = line.match(/(electron\/engine\/[^\s|]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (m) {
    const file = m[1];
    const stmts = parseFloat(m[2]);
    if (stmts < 40 && stmts > 0) {
      lowCovFiles.push({ file, stmts });
    }
  }
}
if (lowCovFiles.length > 0) {
  lowCovFiles.sort((a, b) => a.stmts - b.stmts);
  lowCovFiles.slice(0, 20).forEach(f => {
    console.log(`    ${f.file}: ${f.stmts}%`);
  });
} else {
  console.log('    (none found or coverage data unavailable)');
}

// Save report
const report = {
  coverage: coverageData,
  targets,
  verdict: allPass ? 'PASS' : 'NEEDS_IMPROVEMENT',
  lowCoverageFiles: lowCovFiles.slice(0, 20),
  elapsed,
  timestamp: new Date().toISOString()
};
writeFileSync('coverage-report.json', JSON.stringify(report, null, 2));
console.log('\nReport saved to coverage-report.json');
