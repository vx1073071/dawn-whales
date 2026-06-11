// Show true code CJK lines for top electron files
const fs = require('fs');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

const files = [
  'electron/engine/agents/nl-parser.ts',
  'electron/engine/agents/nlp-sentiment-engine.ts',
  'electron/engine/analysis/strategy-templates.ts',
  'electron/engine/data/market-hotspot.ts',
  'electron/data/python-proxy.ts',
  'electron/engine/data/stock-screener.ts',
];

for (const file of files) {
  const c = fs.readFileSync(file, 'utf8');
  const lines = c.split('\n');
  let inBlock = false;
  console.log(`\n=== ${file} ===`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith('/*')) inBlock = true;
    if (t.endsWith('*/')) { inBlock = false; continue; }
    if (inBlock) continue;
    if (t.startsWith('//')) continue;
    
    // Remove inline comments carefully
    let codePart = line;
    let inStr = false, strChar = '', inBT = false;
    for (let j = 0; j < line.length - 1; j++) {
      const ch = line[j];
      if (!inStr && !inBT && (ch === "'" || ch === '"' || ch === '`')) {
        inStr = true; strChar = ch;
        if (ch === '`') inBT = true;
      } else if (inStr && ch === strChar && line[j - 1] !== '\\') {
        inStr = false;
        if (strChar === '`') inBT = false;
      } else if (!inStr && !inBT && ch === '/' && line[j + 1] === '/') {
        codePart = line.substring(0, j);
        break;
      }
    }
    
    if (CJK.test(codePart)) {
      console.log(`  ${i + 1}: ${codePart.trim().substring(0, 150)}`);
    }
  }
}
