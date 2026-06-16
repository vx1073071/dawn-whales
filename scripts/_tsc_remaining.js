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
  const lines = e.stdout.split('\n').filter(l => l.includes('error TS'));
  console.log('Total:', lines.length);
  
  const groups = {};
  lines.forEach(l => {
    let dir = 'other';
    if (l.includes('src/')) dir = 'src';
    if (l.includes('electron/')) dir = 'electron';
    if (l.includes('server/')) dir = 'server';
    if (l.includes('src/lib/')) dir = 'src/lib';
    if (l.includes('src/hooks/')) dir = 'src/hooks';
    groups[dir] = (groups[dir] || 0) + 1;
  });
  
  Object.entries(groups).sort((a,b) => b[1]-a[1]).forEach(([d, c]) => console.log(`${c} ${d}`));
}
