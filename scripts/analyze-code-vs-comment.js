// Analyze CJK in electron: code vs comment chars for top files
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function analyze(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const lines = c.split('\n');
  let code = 0, comment = 0;
  let inBlock = false;
  
  for (const line of lines) {
    const t = line.trim();
    const matches = line.match(CJK);
    if (!matches) continue;
    const cnt = matches.length;
    
    if (t.startsWith('/*')) inBlock = true;
    if (t.endsWith('*/')) { inBlock = false; comment += cnt; continue; }
    if (inBlock) { comment += cnt; continue; }
    if (t.startsWith('//')) { comment += cnt; continue; }
    
    code += cnt;
  }
  
  return { code, comment, total: code + comment };
}

const topFiles = [
  'electron/engine/analysis/technical-indicators.ts',
  'electron/engine/risk/risk-engine.ts',
  'electron/engine/agents/nl-parser.ts',
  'electron/data/marketplace-service.ts',
  'electron/engine/portfolio/rebalance-engine.ts',
  'electron/data/data-provider.ts',
  'electron/data/lru-cache.ts',
  'electron/engine/risk/compliance-report-engine.ts',
  'electron/engine/risk/anomaly-detection.ts',
  'electron/engine/risk/volume-trigger.ts',
  'electron/engine/portfolio/audit-trail-engine.ts',
  'electron/engine/risk/price-trigger.ts',
  'electron/engine/portfolio/parameter-scanner-v2.ts',
  'electron/engine/data/margin-data.ts',
  'electron/engine/analysis/strategy-ensemble.ts',
  'electron/engine/analysis/anomaly-detector.ts',
  'electron/engine/risk/indicator-trigger.ts',
  'electron/engine/data/data-pipeline-reliability.ts',
  'electron/data/data-versioning.ts',
  'electron/engine/backtest/walk-forward.ts',
  'electron/engine/backtest/backtest-engine-parallel.ts',
  'electron/engine/analysis/strategy-marketplace-search.ts',
  'electron/engine/agents/nlp-sentiment-engine.ts',
  'electron/engine/analysis/capital-flow-rank.ts',
  'electron/engine/data/fund-holdings.ts',
  'electron/engine/portfolio/parameter-scanner.ts',
  'electron/ipc/strategy-execute-handler.ts',
  'electron/engine/portfolio/creator-tier-engine.ts',
  'electron/engine/data/realtime-indicators.ts',
  'electron/engine/data/dragon-tiger-list.ts',
];

let totalCode = 0, totalComment = 0;
for (const f of topFiles) {
  const fullPath = path.join(process.cwd(), f);
  if (!fs.existsSync(fullPath)) continue;
  const r = analyze(fullPath);
  totalCode += r.code;
  totalComment += r.comment;
  if (r.code > 0) {
    console.log(`${f.padEnd(65)} code:${r.code} cmt:${r.comment}`);
  }
}

console.log(`\nTotal code: ${totalCode}`);
console.log(`Total comment: ${totalComment}`);
console.log(`Total: ${totalCode + totalComment}`);
