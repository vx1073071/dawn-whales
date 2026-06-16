const { execSync } = require('child_process');
try {
  const out = execSync('npx tsc --noEmit 2>&1', { 
    cwd: 'C:/Users/vx107/.easyclaw/workspace/dawn-whales', 
    encoding: 'utf8', 
    maxBuffer: 10 * 1024 * 1024,
    timeout: 60000 
  });
  console.log('TSC OK');
} catch (e) {
  const lines = e.stdout.split('\n').filter(l => l.includes('error TS') && l.includes('src/components'));
  require('fs').writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/scripts/_tsc_errors.json', JSON.stringify(lines, null, 2), 'utf8');
  console.log('Wrote', lines.length, 'component errors');
}
