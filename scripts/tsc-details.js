// Get detailed TSC errors for top files
const { execSync } = require('child_process');
const targetFiles = process.argv.slice(2);
try {
  const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8', cwd: __dirname.replace(/scripts$/, ''), timeout: 120000 });
} catch (e) {
  const lines = (e.stdout || '').split('\n').filter(l => l.includes('error TS'));
  
  if (targetFiles.length > 0) {
    targetFiles.forEach(tf => {
      const fileLines = lines.filter(l => l.includes(tf));
      console.log(`\n=== ${tf} (${fileLines.length} errors) ===`);
      fileLines.forEach(l => console.log(l.trim()));
    });
  }
}
