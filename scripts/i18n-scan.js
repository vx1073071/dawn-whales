// i18n hardcoded Chinese character scanner
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dirs = ['src', 'electron'];
const exts = ['.ts', '.tsx', '.js', '.jsx'];
const cnRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

let totalChars = 0;
let totalFiles = 0;
const fileResults = [];

dirs.forEach(dir => {
  const dirPath = path.join(root, dir);
  if (!fs.existsSync(dirPath)) return;
  
  function walk(p) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (p.includes('node_modules') || p.includes('.test.') || p.includes('.spec.') || p.includes('__tests__')) return;
      fs.readdirSync(p).forEach(f => walk(path.join(p, f)));
    } else if (exts.some(e => p.endsWith(e))) {
      const content = fs.readFileSync(p, 'utf-8');
      const matches = content.match(cnRegex);
      if (matches && matches.length > 0) {
        fileResults.push({ file: path.relative(root, p), count: matches.length });
        totalChars += matches.length;
        totalFiles++;
      }
    }
  }
  walk(dirPath);
});

fileResults.sort((a, b) => b.count - a.count);
console.log(`Hardcoded Chinese: ${totalChars} chars in ${totalFiles} files`);
console.log(`\n  src/: ${fileResults.filter(f => f.file.startsWith('src')).reduce((s, f) => s + f.count, 0)} chars`);
console.log(`  electron/: ${fileResults.filter(f => f.file.startsWith('electron')).reduce((s, f) => s + f.count, 0)} chars`);

console.log('\n=== Top 30 Files ===');
fileResults.slice(0, 30).forEach(f => {
  console.log(`  ${f.count.toString().padStart(5)} chars | ${f.file}`);
});
