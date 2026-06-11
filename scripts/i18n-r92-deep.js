// Deep CJK analysis: where exactly is each CJK char?
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

function classify(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const lines = c.split('\n');
  const cats = { singleComment: 0, blockComment: 0, stringSingle: 0, stringDouble: 0, templateLit: 0, jsx: 0, objectKey: 0, other: 0 };
  let inBlock = false;

  for (const line of lines) {
    const t = line.trim();
    const m = line.match(CJK);
    if (!m) continue;
    const cnt = m.length;

    // Block comment tracking
    if (t.startsWith('/*')) { inBlock = true; cats.blockComment += cnt; continue; }
    if (inBlock) { cats.blockComment += cnt; if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('//')) { cats.singleComment += cnt; continue; }

    // Try to classify the CJK location
    // Check JSX text (not inside quotes or braces)
    const jsxMatch = t.match(/>\s*[^<{]*[\u4e00-\u9fff]/);
    if (jsxMatch) { cats.jsx += cnt; continue; }

    // Check template literals
    if (t.includes('`') && t.match(/`[^`]*[\u4e00-\u9fff]/)) { cats.templateLit += cnt; continue; }

    // Check single-quoted strings
    if (t.match(/'[^']*[\u4e00-\u9fff]/)) { cats.stringSingle += cnt; continue; }

    // Check double-quoted strings
    if (t.match(/"[^"]*[\u4e00-\u9fff]/)) { cats.stringDouble += cnt; continue; }

    // Check object keys
    if (t.match(/[\u4e00-\u9fff].*:/)) { cats.objectKey += cnt; continue; }

    cats.other += cnt;
  }
  return cats;
}

const allCats = { singleComment: 0, blockComment: 0, stringSingle: 0, stringDouble: 0, templateLit: 0, jsx: 0, objectKey: 0, other: 0 };
const dirs = ['src', 'electron'];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (!f.startsWith('.') && f !== 'node_modules' && f !== 'dist' && f !== 'locales' && f !== 'coverage') walk(p);
    } else if (/\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
      const cats = classify(p);
      for (const k of Object.keys(cats)) allCats[k] += cats[k];
    }
  }
}
for (const dir of dirs) walk(dir);

console.log('=== CJK Classification ===');
let total = 0;
for (const [k, v] of Object.entries(allCats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(16)} ${v} (${(v * 100 / 17734).toFixed(1)}%)`);
  total += v;
}
console.log(`  ${'TOTAL'.padEnd(16)} ${total}`);
console.log(`\nComments total: ${allCats.singleComment + allCats.blockComment} (${((allCats.singleComment + allCats.blockComment) * 100 / total).toFixed(1)}%)`);
console.log(`Strings total: ${allCats.stringSingle + allCats.stringDouble + allCats.templateLit} (${((allCats.stringSingle + allCats.stringDouble + allCats.templateLit) * 100 / total).toFixed(1)}%)`);
console.log(`JSX total: ${allCats.jsx} (${(allCats.jsx * 100 / total).toFixed(1)}%)`);
console.log(`After removing comments: ${total - allCats.singleComment - allCats.blockComment} CJK remains`);
