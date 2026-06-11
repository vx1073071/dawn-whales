// Scan remaining CJK in src/ code (excluding comments) - show lines
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function scanDir(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules','dist','.git','i18n','scripts'].includes(f.name)) return;
    if (f.isDirectory()) scanDir(p, results);
    else if (/\.(tsx?|jsx?)$/.test(f.name)) {
      try {
        const c = fs.readFileSync(p, 'utf8');
        const lines = c.split('\n');
        let inBlock = false;
        let codeCJK = 0;
        const codeLines = [];
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const t = l.trim();
          if (t.startsWith('/*')) inBlock = true;
          if (t.includes('*/')) { if (inBlock) { inBlock = false; } continue; }
          if (inBlock) continue;
          if (t.startsWith('//')) continue;
          // Remove inline comment
          let codePart = l;
          let inS = false, sC = '', inB = false;
          for (let j = 0; j < l.length - 1; j++) {
            const ch = l[j];
            if (!inS && !inB && (ch === "'" || ch === '"' || ch === '`')) { inS = true; sC = ch; if (ch === '`') inB = true; }
            else if (inS && ch === sC && l[j-1] !== '\\') { inS = false; if (sC === '`') inB = false; }
            else if (!inS && !inB && ch === '/' && l[j+1] === '/') { codePart = l.substring(0, j); break; }
          }
          const m = codePart.match(CJK_GLOBAL);
          if (m) {
            codeCJK += m.length;
            codeLines.push({ line: i+1, text: codePart.trim().substring(0, 140) });
          }
        }
        if (codeCJK > 0) {
          results.push({ file: path.relative(process.cwd(), p).replace(/\\/g, '/'), codeCJK, codeLines });
        }
      } catch {}
    }
  });
  return results;
}

const results = scanDir('src');
results.sort((a, b) => b.codeCJK - a.codeCJK);

console.log('=== src/ files with CJK in code (excl comments) ===');
let total = 0;
results.slice(0, 40).forEach(f => {
  console.log(`\n${f.file} (${f.codeCJK} chars):`);
  f.codeLines.slice(0, 5).forEach(cl => {
    console.log(`  L${cl.line}: ${cl.text}`);
  });
  if (f.codeLines.length > 5) console.log(`  ... +${f.codeLines.length - 5} more lines`);
  total += f.codeCJK;
});
console.log(`\nTotal code CJK in src: ${results.reduce((s,f) => s + f.codeCJK, 0)}`);
