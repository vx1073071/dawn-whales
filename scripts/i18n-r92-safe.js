// R92 Safe: Only replace CJK text that is a standalone JSX text node
// Pattern: line is indented whitespace + CJK text (possibly with emoji/JSX expressions)
// This avoids breaking inline JSX attributes
const fs = require('fs');
const CJK = /[\u4e00-\u9fff]/;
const CJK_G = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

const allKeys = {};
let globalKeyIdx = 0;

function makeKey(comp) {
  return `${comp}.g_${globalKeyIdx++}`;
}

function processFile(filePath) {
  const comp = filePath.split('/').pop().replace(/\.(tsx?|jsx?)$/, '');
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let changes = 0;
  const out = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Only process lines that are pure JSX text nodes
    // Pattern: line starts with whitespace, contains CJK, no HTML tags (< or >)
    if (CJK.test(trimmed) && 
        !trimmed.startsWith('<') && 
        !trimmed.startsWith('//') && 
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('import') &&
        !trimmed.startsWith('export') &&
        !trimmed.includes('=') && // skip attribute lines
        !trimmed.match(/\/[^/]*[\u4e00-\u9fff][^/]*\//) && // skip regex
        /^\s+/.test(line)) { // must be indented (JSX text node)
      
      // This is a standalone JSX text node
      // Replace CJK segments
      if (trimmed.includes('{') && trimmed.includes('}')) {
        // Mixed: has JSX expressions
        const parts = trimmed.split(/(\{[^}]*\})/);
        const rebuilt = parts.map(part => {
          if (part.startsWith('{') && part.endsWith('}')) return part;
          if (CJK.test(part) && part.trim().length > 0) {
            const key = makeKey(comp);
            allKeys[key] = part.trim();
            changes++;
            return `{i18n.t('${key}')}`;
          }
          return part;
        }).join('');
        
        // Preserve indentation
        const indent = line.match(/^(\s*)/)[1];
        out.push(indent + rebuilt);
      } else {
        // Pure CJK text
        const key = makeKey(comp);
        allKeys[key] = trimmed;
        changes++;
        const indent = line.match(/^(\s*)/)[1];
        out.push(indent + `{i18n.t('${key}')}`);
      }
    } else {
      out.push(line);
    }
  }
  
  if (changes > 0) {
    let result = out.join('\n');
    if (!result.includes("import i18n from")) {
      const depth = filePath.split('/').length - 2;
      const i18nPath = '../'.repeat(Math.max(1, depth - 1)) + 'i18n';
      result = `import i18n from '${i18nPath}';\n` + result;
    }
    fs.writeFileSync(filePath, result, 'utf8');
    console.log(`  ${filePath}: ${changes}`);
  }
  return changes;
}

// Only process the 13 previously broken files
const targets = [
  'src/components/backtest/BacktestReportPage.tsx',
  'src/components/billing/ai/AIDrawingPatternPanel.tsx',
  'src/components/billing/community/CreatorLeaderboard.tsx',
  'src/components/billing/core/DesktopShell.tsx',
  'src/components/billing/core/UIAuditPanel.tsx',
  'src/components/billing/onboarding/OnboardingFullKit.tsx',
  'src/components/billing/trade/FractionalTradePanel.tsx',
  'src/components/billing/trade/IBKRBrokerPanel.tsx',
  'src/components/dashboard/DesktopNotificationPanel.tsx',
  'src/components/marketplace/MarketplacePage.tsx',
  'src/components/strategy/StrategyImportExportUI.tsx',
  'src/components/strategy/StrategyOptimizerPanel.tsx',
  'src/components/tools/DataExportPage.tsx',
];

let total = 0;
for (const f of targets) {
  if (!fs.existsSync(f)) continue;
  total += processFile(f);
}

console.log(`\nTotal: ${total} replacements, ${Object.keys(allKeys).length} keys`);

if (Object.keys(allKeys).length > 0) {
  const localeFiles = ['zh-CN.json', 'en.json', 'zh-HK.json', 'zh-TW.json', 'ja.json', 'ko.json', 'fr.json', 'it.json', 'de.json'];
  for (const lf of localeFiles) {
    const lp = `src/i18n/locales/${lf}`;
    if (!fs.existsSync(lp)) continue;
    const loc = JSON.parse(fs.readFileSync(lp, 'utf8'));
    for (const [key, value] of Object.entries(allKeys)) {
      const [comp, k] = key.split('.');
      if (!loc[comp]) loc[comp] = {};
      loc[comp][k] = value;
    }
    fs.writeFileSync(lp, JSON.stringify(loc, null, 2) + '\n', 'utf8');
  }
  console.log('Locale files updated');
}
