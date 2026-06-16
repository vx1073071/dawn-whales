const { execSync } = require('child_process');
const ROOT = 'C:/Users/vx107/.easyclaw/workspace/quant-moo';

try {
  const r = execSync('npx vitest run tests/condition-engine.test.ts 2>&1', {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 120000,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
  });
  const lines = r.split('\n');
  // Find the failure details
  const failSection = [];
  let inFail = false;
  for (const l of lines) {
    if (l.includes('Failed Tests') || l.includes('AssertionError') || l.includes('expected') || l.includes('FAIL')) inFail = true;
    if (inFail) failSection.push(l);
    if (failSection.length > 20) break;
  }
  console.log(failSection.join('\n'));
} catch(e) {
  if (e.stdout) {
    const lines = e.stdout.split('\n');
    const failSection = [];
    let inFail = false;
    for (const l of lines) {
      if (l.includes('Failed Tests') || l.includes('AssertionError') || l.includes('× ') || l.includes('FAIL')) inFail = true;
      if (inFail) failSection.push(l);
      if (failSection.length > 30) break;
    }
    console.log(failSection.join('\n'));
  }
}
