// TSC error breakdown + per-file counts
const { execSync } = require('child_process');
try {
  const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8', cwd: __dirname.replace(/scripts$/, ''), timeout: 120000 });
  console.log('TSC: 0 errors');
} catch (e) {
  const lines = (e.stdout || '').split('\n').filter(l => l.includes('error TS'));
  console.log(`Total errors: ${lines.length}`);
  
  // By error code
  const codes = {};
  lines.forEach(l => {
    const m = l.match(/error TS(\d+)/);
    if (m) codes[m[1]] = (codes[m[1]] || 0) + 1;
  });
  console.log('\n=== Error Code Breakdown ===');
  Object.entries(codes).sort((a,b) => b[1]-a[1]).forEach(([code, count]) => {
    console.log(`  TS${code}: ${count}`);
  });

  // By file (top 20)
  const files = {};
  lines.forEach(l => {
    const m = l.match(/^(.+?)\(\d+,\d+\)/);
    if (m) files[m[1]] = (files[m[1]] || 0) + 1;
  });
  console.log('\n=== Top 20 Files by Error Count ===');
  Object.entries(files).sort((a,b) => b[1]-a[1]).slice(0, 20).forEach(([file, count]) => {
    console.log(`  ${count.toString().padStart(3)} errors | ${file}`);
  });
  console.log(`\nTotal files with errors: ${Object.keys(files).length}`);
}
