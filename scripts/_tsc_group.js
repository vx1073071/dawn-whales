// Check TSC errors grouped by file
const { execSync } = require('child_process');
try {
  const out = execSync('npx tsc --noEmit 2>&1', { cwd: 'C:/Users/vx107/.easyclaw/workspace/dawn-whales', encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 60000 });
  console.log('No errors!');
} catch (e) {
  const lines = e.stdout.split('\n').filter(l => l.includes('error TS'));
  console.log('Total errors:', lines.length);
  
  // Group by directory
  const groups = {};
  lines.forEach(l => {
    const m = l.match(/^(src\/components\/[^\(]+)/);
    if (m) {
      const dir = m[1].split('/').slice(0, 3).join('/');
      const file = m[1].split('/').slice(0, 3).join('/') + '/' + m[1].split('/')[3].split('.')[0];
      groups[file] = (groups[file] || 0) + 1;
    }
  });
  
  const sorted = Object.entries(groups).sort((a,b) => b[1]-a[1]).slice(0, 40);
  sorted.forEach(([f, c]) => console.log(`${String(c).padStart(3)} ${f}`));
  console.log('---');
  console.log(`Top 40 files account for ${sorted.reduce((s,[,c]) => s+c, 0)} of ${lines.length} total errors`);
}
