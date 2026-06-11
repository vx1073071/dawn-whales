const { execSync } = require('child_process');
const ROOT = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales';

try {
  const r = execSync('npx vitest run tests/condition-engine.test.ts --reporter=verbose 2>&1', {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 120000,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
  });
  
  const lines = r.split('\n');
  const summary = lines.filter(l => /Tests|Test Files|passed|failed|Duration/.test(l));
  console.log('=== condition-engine.test.ts ===');
  summary.forEach(l => console.log(l.trim()));
  
  const failLines = lines.filter(l => l.includes('\u00d7') || l.includes('FAIL'));
  console.log('Fail markers:', failLines.length);
  failLines.slice(0, 10).forEach(l => console.log('  ' + l.trim().substring(0, 200)));
} catch(e) {
  console.log('Exit:', e.status);
  if (e.stdout) {
    const lines = e.stdout.split('\n');
    const summary = lines.filter(l => /Tests|Test Files|passed|failed|Duration/.test(l));
    summary.forEach(l => console.log(l.trim()));
    const failLines = lines.filter(l => l.includes('\u00d7') || l.includes('FAIL'));
    console.log('Fail markers:', failLines.length);
    failLines.slice(0, 10).forEach(l => console.log('  ' + l.trim().substring(0, 200)));
  }
}
