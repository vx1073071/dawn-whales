// R92 i18n analyzer: split CJK into comment vs code vs string
const fs = require('fs');
const path = require('path');

function analyze(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const lines = c.split('\n');
  let commentCJK = 0, codeCJK = 0, stringCJK = 0;
  let inBlockComment = false;
  const cjkRe = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      const m = trimmed.match(cjkRe);
      if (m) commentCJK += m.length;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      const m = trimmed.match(cjkRe);
      if (m) commentCJK += m.length;
      continue;
    }
    if (trimmed.startsWith('//')) {
      const m = trimmed.match(cjkRe);
      if (m) commentCJK += m.length;
      continue;
    }
    // Code line
    const m = trimmed.match(cjkRe);
    if (m) {
      codeCJK += m.length;
      // Check string literals with CJK
      // Match content inside quotes (simple heuristic)
      const strRe = /(?:'([^']*[\u4e00-\u9fff][^']*)'|"([^"]*[\u4e00-\u9fff][^"]*)"|`([^`]*[\u4e00-\u9fff][^`]*)`)/g;
      let sm;
      while ((sm = strRe.exec(trimmed)) !== null) {
        const s = sm[1] || sm[2] || sm[3];
        if (s) {
          const cm = s.match(cjkRe);
          if (cm) stringCJK += cm.length;
        }
      }
    }
  }
  return { commentCJK, codeCJK, stringCJK };
}

const dirs = ['src', 'electron'];
let totalComment = 0, totalCode = 0, totalString = 0;
const fileDetails = [];

function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (!f.startsWith('.') && f !== 'node_modules' && f !== 'dist' && f !== 'locales' && f !== 'coverage') walk(p);
    } else if (/\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
      const r = analyze(p);
      totalComment += r.commentCJK;
      totalCode += r.codeCJK;
      totalString += r.stringCJK;
      if (r.codeCJK > 0) fileDetails.push({ path: p.replace(/\\/g, '/'), ...r });
    }
  }
}
for (const dir of dirs) walk(dir);

console.log('=== CJK Category Breakdown ===');
console.log('Comment CJK:', totalComment, '(does not need i18n)');
console.log('Code CJK:   ', totalCode, '(in actual code lines)');
console.log('String CJK: ', totalString, '(in string literals - MUST replace)');
console.log('Total:      ', totalComment + totalCode);
console.log('\nReal target: code CJK < 3,000');
console.log('Need to remove:', Math.max(0, totalCode - 3000), 'CJK from code');

fileDetails.sort((a, b) => b.codeCJK - a.codeCJK);
console.log('\n=== Top 30 files by code CJK ===');
fileDetails.slice(0, 30).forEach(f => {
  console.log(`${f.codeCJK} (str:${f.stringCJK} cmt:${f.commentCJK}) ${f.path}`);
});
