// Strip CJK from inline comments in electron files
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

function stripFile(fp) {
  const content = fs.readFileSync(fp, 'utf8');
  const lines = content.split('\n');
  let changes = 0;
  const out = [];

  for (const line of lines) {
    // Find inline comment: code // comment
    const idx = line.indexOf('//');
    if (idx > 0) {
      const codePart = line.substring(0, idx);
      const commentPart = line.substring(idx);
      if (CJK.test(commentPart)) {
        let stripped = commentPart.replace(CJK, '');
        stripped = stripped.replace(/\s{2,}/g, ' ').replace(/\s+$/, '');
        if (stripped.trim() === '//') {
          out.push(codePart.trimEnd());
        } else {
          out.push(codePart + stripped);
        }
        changes++;
        continue;
      }
    }
    out.push(line);
  }

  if (changes > 0) {
    fs.writeFileSync(fp, out.join('\n'), 'utf8');
  }
  return changes;
}

let total = 0;
const files = [
  'electron/engine/risk/risk-engine.ts',
  'electron/engine/data/margin-data.ts',
  'electron/engine/analysis/capital-flow-rank.ts',
  'electron/engine/data/fund-holdings.ts',
  'electron/engine/data/dragon-tiger-list.ts',
  'electron/engine/portfolio/portfolio-risk.ts',
  'electron/engine/agents/nl-parser.ts',
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const c = stripFile(f);
  if (c > 0) {
    console.log(`  ${f}: ${c} inline comments stripped`);
    total += c;
  }
}
console.log(`Total: ${total} inline comments cleaned`);
