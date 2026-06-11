// Analyze: how much CJK is in true code (not in any comments)
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function countTrueCodeCJK(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const lines = c.split('\n');
  let inBlock = false;
  let codeChars = 0;
  
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('/*')) { inBlock = true; }
    if (t.endsWith('*/')) { inBlock = false; continue; }
    if (inBlock) continue;
    if (t.startsWith('//')) continue;
    
    // Remove inline comment
    let codePart = line;
    let inStr = false;
    let strChar = '';
    let inBT = false;
    for (let i = 0; i < line.length - 1; i++) {
      const ch = line[i];
      if (!inStr && !inBT && (ch === "'" || ch === '"' || ch === '`')) {
        inStr = true;
        strChar = ch;
        if (ch === '`') inBT = true;
      } else if (inStr && ch === strChar && line[i - 1] !== '\\') {
        inStr = false;
        if (strChar === '`') inBT = false;
      } else if (!inStr && !inBT && ch === '/' && line[i + 1] === '/') {
        codePart = line.substring(0, i);
        break;
      }
    }
    
    const m = codePart.match(CJK);
    if (m) codeChars += m.length;
  }
  
  return codeChars;
}

// Scan ALL electron files
function scanAll(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules', 'dist', '.git'].includes(f.name)) return;
    if (f.isDirectory()) scanAll(p, results);
    else if (/\.ts$/.test(f.name) && !f.name.includes('.test.')) {
      try {
        const chars = countTrueCodeCJK(p);
        if (chars > 0) {
          results.push({ file: path.relative(process.cwd(), p).replace(/\\/g, '/'), chars });
        }
      } catch {}
    }
  });
  return results;
}

const results = scanAll('electron');
results.sort((a, b) => b.chars - a.chars);

console.log('electron/ files with CJK in TRUE CODE (excluding all comments):');
let total = 0;
results.forEach(f => {
  console.log(`${f.chars.toString().padStart(5)} ${f.file}`);
  total += f.chars;
});
console.log(`\nTotal true code CJK: ${total}`);
