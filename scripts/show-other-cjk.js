// Show "other" CJK lines for top electron files
const fs = require('fs');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

const files = [
  'electron/engine/risk/risk-engine.ts',
  'electron/engine/risk/compliance-report-engine.ts',
  'electron/engine/analysis/anomaly-detector.ts',
  'electron/engine/portfolio/audit-trail-engine.ts',
  'electron/data/data-provider.ts',
  'electron/engine/risk/anomaly-detection.ts',
  'electron/engine/data/data-pipeline-reliability.ts',
  'electron/engine/risk/volume-trigger.ts',
  'electron/data/lru-cache.ts',
  'electron/engine/risk/price-trigger.ts',
];

for (const file of files) {
  const c = fs.readFileSync(file, 'utf8');
  const lines = c.split('\n');
  let inBlock = false;
  console.log(`\n=== ${file} ===`);
  let shown = 0;
  
  for (let i = 0; i < lines.length && shown < 8; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith('/*')) inBlock = true;
    if (t.includes('*/')) { if (inBlock) { inBlock = false; } continue; }
    if (inBlock) continue;
    if (t.startsWith('//')) continue;
    
    // Remove inline comment
    let codePart = line;
    let inStr = false, strChar = '', inBT = false;
    for (let j = 0; j < line.length - 1; j++) {
      const ch = line[j];
      if (!inStr && !inBT && (ch === "'" || ch === '"' || ch === '`')) {
        inStr = true; strChar = ch; if (ch === '`') inBT = true;
      } else if (inStr && ch === strChar && line[j - 1] !== '\\') {
        inStr = false; if (strChar === '`') inBT = false;
      } else if (!inStr && !inBT && ch === '/' && line[j + 1] === '/') {
        codePart = line.substring(0, j);
        break;
      }
    }
    
    if (CJK.test(codePart)) {
      console.log(`  ${i + 1}: ${codePart.trim().substring(0, 160)}`);
      shown++;
    }
  }
}
