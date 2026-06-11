// R92 test runner - captures vitest output and summarizes failures
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

console.log('Running vitest...');
try {
  const output = execSync('npx vitest run 2>&1', {
    encoding: 'utf-8',
    timeout: 300000,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
  });
  
  // Save raw output
  fs.writeFileSync(path.join(ROOT, 'scripts/r92-test-output.txt'), output);
  
  // Parse summary
  const lines = output.split('\n');
  
  // Find test summary line
  const summaryLines = lines.filter(l => l.includes('Tests') || l.includes('Test Files') || l.includes('passed') || l.includes('failed'));
  
  console.log('\n=== TEST SUMMARY ===');
  summaryLines.forEach(l => console.log(l.trim()));
  
  // Find FAIL lines
  const failLines = lines.filter(l => /FAIL|×/.test(l));
  console.log(`\n=== FAIL LINES (${failLines.length}) ===`);
  failLines.slice(0, 50).forEach(l => console.log(l.trim()));
  
  // Find specific failure patterns
  const assertionFails = lines.filter(l => l.includes('→ ') || l.includes('AssertionError') || l.includes('expected'));
  console.log(`\n=== ASSERTION FAILURES (${assertionFails.length}) ===`);
  assertionFails.slice(0, 30).forEach(l => console.log(l.trim()));
  
} catch(e) {
  console.log('Test run failed with exit code:', e.status);
  if (e.stdout) {
    const output = e.stdout;
    fs.writeFileSync(path.join(ROOT, 'scripts/r92-test-output.txt'), output);
    const lines = output.split('\n');
    const summaryLines = lines.filter(l => l.includes('Tests') || l.includes('Test Files') || l.includes('passed') || l.includes('failed'));
    console.log('\n=== TEST SUMMARY ===');
    summaryLines.forEach(l => console.log(l.trim()));
    const failLines = lines.filter(l => /FAIL|×/.test(l));
    console.log(`\n=== FAIL LINES (${failLines.length}) ===`);
    failLines.slice(0, 50).forEach(l => console.log(l.trim()));
    const assertionFails = lines.filter(l => l.includes('→ ') || l.includes('expected'));
    console.log(`\n=== ASSERTION FAILURES (${assertionFails.length}) ===`);
    assertionFails.slice(0, 30).forEach(l => console.log(l.trim()));
  }
  if (e.stderr) console.log('STDERR:', e.stderr.slice(0, 500));
}
