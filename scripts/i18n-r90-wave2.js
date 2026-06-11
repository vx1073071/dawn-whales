// R90 Wave 2: Process electron files - handle template literals and complex patterns
const fs = require('fs');
const path = require('path');

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function getI18nImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const i18nDir = path.join(process.cwd(), 'src/i18n');
  let rel = path.relative(fileDir, i18nDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function getFileBase(filePath) {
  return path.basename(filePath).replace(/\.(ts|tsx)$/, '')
    .split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function countCJK(s) { return (s.match(CJK_GLOBAL) || []).length; }

// Process specific files manually with targeted replacements
const targets = [
  'electron/engine/agents/ai-report-generator.ts',
  'electron/engine/agents/nl-parser.ts',
  'electron/data/marketplace-service.ts',
  'electron/engine/agents/nlp-sentiment-engine.ts',
  'electron/engine/data/margin-data.ts',
  'electron/engine/risk/risk-engine.ts',
  'electron/data/data-provider.ts',
  'electron/engine/data/financial-reports.ts',
  'electron/engine/analysis/capital-flow-rank.ts',
  'electron/engine/data/fund-holdings.ts',
  'electron/engine/portfolio/portfolio-risk.ts',
  'electron/engine/data/dragon-tiger-list.ts',
  'electron/engine/data/market-breadth.ts',
  'electron/engine/data/earnings-calendar.ts',
  'electron/data/lru-cache.ts',
  'electron/engine/data/consumer-data.ts',
  'electron/data/database.ts',
  'electron/engine/backtest/backtest-engine.ts',
  'electron/engine/backtest/walk-forward.ts',
  'electron/engine/risk/anomaly-detection.ts',
  'electron/engine/analysis/capital-flow-monitor.ts',
  'electron/engine/analysis/valuation-data.ts',
  'electron/engine/data/quote-stream.ts',
  'electron/engine/data/dividend-calendar.ts',
  'electron/engine/portfolio/creator-tier-engine.ts',
  'electron/engine/analysis/strategy-marketplace-search.ts',
  'electron/engine/analysis/strategy-ensemble.ts',
  'electron/engine/data/sector-rotation-v2.ts',
  'electron/engine/data/unlock-calendar.ts',
  'electron/engine/analysis/strategy-templates.ts',
];

let totalKeys = {};
let totalRemoved = 0;
let totalFiles = 0;

for (const file of targets) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const oldChars = countCJK(content);
  const fileBase = getFileBase(file);
  const keys = {};
  let keyIdx = 0;
  
  // Check if already has i18n import
  const hasI18n = content.includes("import i18n from");
  
  // Step 1: Replace simple string literals (single and double quoted)
  content = content.replace(/'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g, (match, str) => {
    // Skip if inside comment
    const key = `${fileBase}.k${keyIdx++}`;
    keys[key] = str;
    return `i18n.t('${key}')`;
  });
  
  content = content.replace(/"([^"\n]*[\u4e00-\u9fff][^"\n]*)"/g, (match, str) => {
    const key = `${fileBase}.k${keyIdx++}`;
    keys[key] = str;
    return `i18n.t('${key}')`;
  });
  
  // Step 2: Replace template literals (including multi-line with interpolation)
  // For templates with ${}, we keep the template structure but extract Chinese segments
  // Strategy: Convert `中文 ${expr} 中文` to `${i18n.t('key1')}${expr}${i18n.t('key2')}`
  content = content.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (match, inner) => {
    if (!CJK.test(inner)) return match;
    
    if (!inner.includes('${')) {
      // Simple template without interpolation - replace whole thing
      const key = `${fileBase}.k${keyIdx++}`;
      keys[key] = inner;
      return `i18n.t('${key}')`;
    }
    
    // Complex template: split into segments around ${} expressions
    // Replace Chinese text segments with i18n.t() calls
    let result = inner;
    // Find Chinese text segments (between ${} expressions)
    result = result.replace(/([\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef，。！？、：；""''（）【】《》\s·—…\-]+?)(?=\$\{|$)/g, (seg) => {
      if (!CJK.test(seg)) return seg;
      const trimmed = seg.trim();
      if (!trimmed) return seg;
      const key = `${fileBase}.k${keyIdx++}`;
      keys[key] = trimmed;
      return `\${i18n.t('${key}')}`;
    });
    
    // Also handle Chinese text after ${} expressions
    result = result.replace(/(\$\{[^}]+\})([\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef，。！？、：；""''（）【】《》\s·—…\-]+)/g, (match, expr, chinese) => {
      const trimmed = chinese.trim();
      if (!trimmed) return match;
      const key = `${fileBase}.k${keyIdx++}`;
      keys[key] = trimmed;
      return `${expr}\${i18n.t('${key}')}`;
    });
    
    return '`' + result + '`';
  });
  
  const newChars = countCJK(content);
  const removed = oldChars - newChars;
  
  if (removed > 0) {
    // Add i18n import if needed
    if (!hasI18n && Object.keys(keys).length > 0) {
      const importPath = getI18nImportPath(file);
      const lines = content.split('\n');
      let lastImportIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) lastImportIdx = i;
      }
      lines.splice(lastImportIdx + 1, 0, `import i18n from '${importPath}';`);
      content = lines.join('\n');
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ${file}: ${oldChars} → ${newChars} (-${removed}, ${Object.keys(keys).length} keys)`);
    Object.assign(totalKeys, keys);
    totalRemoved += removed;
    totalFiles++;
  }
}

console.log(`\n=== Wave 2 Summary ===`);
console.log(`Files: ${totalFiles}`);
console.log(`Chars removed: ${totalRemoved}`);
console.log(`Keys: ${Object.keys(totalKeys).length}`);

// Save keys for translation
fs.writeFileSync(
  'scripts/i18n-r90-wave2-keys.json',
  JSON.stringify(totalKeys, null, 2), 'utf8'
);
console.log('Keys saved to scripts/i18n-r90-wave2-keys.json');
