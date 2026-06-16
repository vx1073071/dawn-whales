const { execSync } = require('child_process');
const ROOT = 'C:/Users/vx107/.easyclaw/workspace/quant-moo';

// Run the 9 files that had randomUUID failures
const files = [
  'tests/condition-engine.test.ts',
  'tests/condition-engine-integration.test.ts',
  'tests/condition-engine-pressure.test.ts',
  'tests/trade-executor.test.ts',
  'tests/ws-trade-e2e.test.ts',
  'tests/debug-signal.test.ts',
  'tests/j-37-03-condition-negative.test.ts',
  'tests/nl-parser.test.ts',
  'tests/nl-parser-extension.test.ts',
];

const fileList = files.join(' ');
console.log('Running', files.length, 'previously-failing files...');

try {
  const r = execSync(`npx vitest run ${fileList} 2>&1`, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 300000,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
  });
  
  const lines = r.split('\n');
  const summary = lines.filter(l => /Tests|Test Files|Duration/.test(l));
  console.log('\n=== SUMMARY ===');
  summary.forEach(l => console.log(l.trim()));
} catch(e) {
  if (e.stdout) {
    const lines = e.stdout.split('\n');
    const summary = lines.filter(l => /Tests|Test Files|Duration/.test(l));
    console.log('\n=== SUMMARY ===');
    summary.forEach(l => console.log(l.trim()));
    
    const failLines = lines.filter(l => l.includes('\u00d7'));
    console.log('\nFails:', failLines.length);
    failLines.slice(0, 20).forEach(l => console.log('  ' + l.trim().substring(0, 200)));
  }
}
