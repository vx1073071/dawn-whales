// R92 Surgical: Replace CJK in JSX text with i18n.t() calls
// Works by finding >CJK_TEXT< patterns and replacing them
const fs = require('fs');

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const CJK_G = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

const files = [
  'src/components/billing/onboarding/OnboardingFullKit.tsx',
  'src/components/billing/core/GAFinalPanel.tsx',
  'src/components/billing/ai/AIDrawingPatternPanel.tsx',
  'src/components/billing/trade/DataSourcePanel.tsx',
  'src/components/tools/DataExportPage.tsx',
  'src/components/dashboard/DesktopNotificationPanel.tsx',
  'src/components/billing/market/BacktestPerformancePanel.tsx',
  'src/components/billing/core/LandingPageV18.tsx',
  'src/components/billing/trade/IBKRBrokerPanel.tsx',
  'src/components/billing/core/GuestModeShell.tsx',
  'src/components/billing/wallet/USDTPaymentPanel.tsx',
  'src/components/billing/wallet/P2PBlacklistPanel.tsx',
  'src/components/billing/core/DesktopShell.tsx',
  'src/components/billing/core/HelpCenter.tsx',
  'src/components/billing/core/UIPolishKit.tsx',
  'src/components/billing/wallet/P2PTransferPage.tsx',
  'src/components/billing/wallet/SecurityCenter.tsx',
  'src/components/billing/wallet/DisputeCenter.tsx',
  'src/components/billing/community/GrowthPanel.tsx',
  'src/components/billing/trade/FractionalTradePanel.tsx',
  'src/components/billing/ai/AIBillingPanel.tsx',
  'src/components/risk/NotificationCenter.tsx',
  'src/components/billing/core/DownloadPage.tsx',
  'src/components/billing/core/DesktopCleanupShell.tsx',
  'src/components/marketplace/MarketplacePage.tsx',
  'src/components/backtest/BacktestReportPage.tsx',
  'src/components/strategy/StrategyOptimizerPanel.tsx',
  'src/components/billing/core/UIAuditPanel.tsx',
  'src/components/strategy/StrategyImportExportUI.tsx',
  'src/components/billing/community/CreatorLeaderboard.tsx',
];

const allNewKeys = {};

for (const filePath of files) {
  if (!fs.existsSync(filePath)) continue;
  
  const componentName = filePath.split('/').pop().replace('.tsx', '').replace('.ts', '');
  let content = fs.readFileSync(filePath, 'utf8');
  let keyIdx = 0;
  const origLen = content.length;
  
  // Strategy: find each CJK segment and replace inline
  // We process the file character by character looking for JSX text regions
  
  const lines = content.split('\n');
  const newLines = [];
  let fileChanged = false;
  
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    
    // Skip if no CJK
    if (!CJK.test(line)) {
      newLines.push(line);
      continue;
    }
    
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      newLines.push(line);
      continue;
    }
    // Skip regex
    if (trimmed.match(/\/[^/]*[\u4e00-\u9fff][^/]*\//g)) {
      newLines.push(line);
      continue;
    }
    // Skip i18n locale data
    if (filePath.includes('locales/')) {
      newLines.push(line);
      continue;
    }
    
    // Find CJK segments and replace them
    // Pattern: Chinese text that is NOT inside i18n.t(), string quotes, or regex
    
    // Step 1: Replace CJK in JSX text nodes (between > and <)
    // Match: >TEXT_WITH_CJK< where TEXT doesn't contain { or }
    line = line.replace(/>([^<{}]*[\u4e00-\u9fff][^<{}]*)</g, (match, text) => {
      const key = `${componentName}.s_${keyIdx++}`;
      allNewKeys[key] = text.trim();
      return `>{i18n.t('${key}')}` + '<';
    });
    
    // Step 2: Replace CJK in mixed JSX (text + {expr})
    // Match: >TEXT_WITH_CJK {expr} MORE_CJK<
    line = line.replace(/>([^<]*[\u4e00-\u9fff][^<]*)</g, (match, text) => {
      // Split by JSX expressions
      const parts = text.split(/(\{[^}]*\})/);
      const newParts = parts.map(part => {
        if (part.startsWith('{') && part.endsWith('}')) return part; // JSX expression
        if (CJK.test(part)) {
          const key = `${componentName}.s_${keyIdx++}`;
          allNewKeys[key] = part.trim();
          return `{i18n.t('${key}')}`;
        }
        return part;
      });
      return '>' + newParts.join('') + '<';
    });
    
    // Step 3: Replace CJK in string literals (not inside i18n.t)
    line = line.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (match, text, offset) => {
      // Check if inside i18n.t()
      const before = line.substring(0, offset);
      if (before.endsWith("i18n.t(") || before.endsWith("t(")) return match;
      if (before.match(/\/[^/]*$/)) return match; // regex
      if (text.includes('/') || text.includes('\\')) return match; // path
      // Check if it's an object key
      const after = line.substring(offset + match.length);
      if (after.trimStart().startsWith(':')) return match;
      
      const key = `${componentName}.s_${keyIdx++}`;
      allNewKeys[key] = text;
      return `i18n.t('${key}')`;
    });
    
    if (line !== lines[li]) fileChanged = true;
    newLines.push(line);
  }
  
  if (fileChanged) {
    let result = newLines.join('\n');
    
    // Ensure i18n import
    if (!result.includes("import i18n from")) {
      const depth = filePath.split('/').length - 2;
      const i18nPath = '../'.repeat(Math.max(1, depth - 1)) + 'i18n';
      result = `import i18n from '${i18nPath}';\n` + result;
    }
    
    fs.writeFileSync(filePath, result, 'utf8');
    console.log(`  ${filePath}: ${keyIdx} replacements`);
  }
}

// Add keys to locale files
const keyCount = Object.keys(allNewKeys).length;
console.log(`\nTotal new keys: ${keyCount}`);

if (keyCount > 0) {
  const localeFiles = ['zh-CN.json', 'en.json', 'zh-HK.json', 'zh-TW.json', 'ja.json', 'ko.json', 'fr.json', 'it.json', 'de.json'];
  for (const locFile of localeFiles) {
    const locPath = `src/i18n/locales/${locFile}`;
    if (!fs.existsSync(locPath)) continue;
    const loc = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    for (const [key, value] of Object.entries(allNewKeys)) {
      const [comp, k] = key.split('.');
      if (!loc[comp]) loc[comp] = {};
      loc[comp][k] = value;
    }
    fs.writeFileSync(locPath, JSON.stringify(loc, null, 2) + '\n', 'utf8');
  }
  console.log(`Added to ${localeFiles.length} locale files`);
}

fs.writeFileSync('scripts/i18n-r92-surgical-keys.json', JSON.stringify(allNewKeys, null, 2));
