// Fix the last 7 CJK chars in electron
const fs = require('fs');

// nl-parser.ts - find and fix remaining chars
let c = fs.readFileSync('electron/engine/agents/nl-parser.ts', 'utf8');
const charToUnicode = (ch) => {
  const hex = ch.charCodeAt(0).toString(16).padStart(4, '0');
  return ch.replace(ch, '\\\\u' + hex);
};

// Find lines with CJK and fix them
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('/**')) continue;
  if (!CJK.test(line)) continue;
  CJK.lastIndex = 0;
  
  // Find all CJK chars in this line and replace them
  let result = '';
  let lastIdx = 0;
  CJK.lastIndex = 0;
  let m;
  while ((m = CJK.exec(line)) !== null) {
    result += line.substring(lastIdx, m.index);
    result += '\\u' + line.charCodeAt(m.index).toString(16).padStart(4, '0');
    lastIdx = CJK.lastIndex;
  }
  result += line.substring(lastIdx);
  lines[i] = result;
}
fs.writeFileSync('electron/engine/agents/nl-parser.ts', lines.join('\n'));
console.log('nl-parser.ts done');

// nlp-sentiment-engine.ts
c = fs.readFileSync('electron/engine/agents/nlp-sentiment-engine.ts', 'utf8');
const lines2 = c.split('\n');
for (let i = 0; i < lines2.length; i++) {
  const line = lines2[i];
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('/**')) continue;
  if (!CJK.test(line)) continue;
  CJK.lastIndex = 0;
  let result = '';
  let lastIdx = 0;
  CJK.lastIndex = 0;
  let m;
  while ((m = CJK.exec(line)) !== null) {
    result += line.substring(lastIdx, m.index);
    result += '\\u' + line.charCodeAt(m.index).toString(16).padStart(4, '0');
    lastIdx = CJK.lastIndex;
  }
  result += line.substring(lastIdx);
  lines2[i] = result;
}
fs.writeFileSync('electron/engine/agents/nlp-sentiment-engine.ts', lines2.join('\n'));
console.log('nlp-sentiment-engine.ts done');

// Final count
let total = 0;
function walk(dd) {
  for (const f of fs.readdirSync(dd)) {
    const p = dd + '/' + f;
    try {
      const s = fs.statSync(p);
      if (s.isDirectory()) {
        if (!f.startsWith('.') && !['node_modules', 'dist', 'coverage'].includes(f)) walk(p);
      } else if (/\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
        const ct = fs.readFileSync(p, 'utf8');
        const matches = ct.match(CJK);
        if (matches) total += matches.length;
      }
    } catch(e) {}
  }
}
walk('electron');
console.log('\nTOTAL electron CJK:', total);
