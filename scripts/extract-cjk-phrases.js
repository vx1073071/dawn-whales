// Extract all CJK phrases from comments for bulk translation
const fs = require('fs');
const path = require('path');
const CJK_RANGE = '[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]';
const CJK_PHRASE = new RegExp(`(${CJK_RANGE}{2,20})`, 'g');

function extractFromComments(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const lines = c.split('\n');
  const phrases = new Set();
  let inBlock = false;

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('/*')) inBlock = true;
    if (inBlock) {
      let m;
      while ((m = CJK_PHRASE.exec(t)) !== null) phrases.add(m[1]);
      CJK_PHRASE.lastIndex = 0;
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('//')) {
      let m;
      while ((m = CJK_PHRASE.exec(t)) !== null) phrases.add(m[1]);
      CJK_PHRASE.lastIndex = 0;
    }
    // Also check inline comments
    const inlineMatch = line.match(/\/\/(.*)/);
    if (inlineMatch && !t.startsWith('//')) {
      let m;
      while ((m = CJK_PHRASE.exec(inlineMatch[1])) !== null) phrases.add(m[1]);
      CJK_PHRASE.lastIndex = 0;
    }
  }
  return phrases;
}

const allPhrases = new Set();
const dirs = ['src', 'electron'];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (!f.startsWith('.') && f !== 'node_modules' && f !== 'dist' && f !== 'locales' && f !== 'coverage') walk(p);
    } else if (/\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
      const phrases = extractFromComments(p);
      phrases.forEach(ph => allPhrases.add(ph));
    }
  }
}
for (const dir of dirs) walk(dir);

// Sort by length (longest first)
const sorted = [...allPhrases].sort((a, b) => b.length - a.length);
console.log(`Total unique CJK phrases in comments: ${sorted.length}`);
console.log('\n=== Top 100 longest phrases ===');
sorted.slice(0, 100).forEach(p => console.log(`  ${p.length} chars: ${p}`));

// Save all phrases for translation
fs.writeFileSync('scripts/cjk-phrases.json', JSON.stringify(sorted, null, 2));
console.log(`\nSaved to scripts/cjk-phrases.json`);
