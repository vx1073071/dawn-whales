// R92 Final v2: Whole-file CJK replacement
const fs = require('fs');
const CJK = /[\u4e00-\u9fff]/;
const CJK_G = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g;

const allKeys = {};
let globalKeyIdx = 0;

function makeKey(comp) {
  return `${comp}.f_${globalKeyIdx++}`;
}

function processFile(filePath) {
  const comp = filePath.split('/').pop().replace(/\.(tsx?|jsx?)$/, '');
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  // Step 1: Find all >...CJK...< segments (multi-line aware)
  // Match: > followed by any text (including newlines) containing CJK, followed by <
  content = content.replace(/>([^<]*[\u4e00-\u9fff][^<]*)</g, (match, text) => {
    // Split by JSX expressions
    if (text.includes('{') && text.includes('}')) {
      const parts = text.split(/(\{[^}]*\})/);
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
      return '>' + rebuilt + '<';
    } else {
      // Pure CJK text
      if (text.trim().length > 0) {
        const key = makeKey(comp);
        allKeys[key] = text.trim();
        changes++;
        return `>{i18n.t('${key}')}<`;
      }
      return match;
    }
  });
  
  // Step 2: Handle string literals 'CJK'
  content = content.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (match, text, offset) => {
    const before = content.substring(0, offset);
    if (before.endsWith('i18n.t(') || before.endsWith('t(')) return match;
    if (before.match(/\/[^/]*$/)) return match; // regex
    if (text.includes('/') || text.includes('\\') || text.includes('http')) return match;
    const after = content.substring(offset + match.length);
    if (after.trimStart().startsWith(':')) return match; // object key
    
    const key = makeKey(comp);
    allKeys[key] = text;
    changes++;
    return `i18n.t('${key}')`;
  });
  
  if (changes > 0) {
    // Ensure i18n import
    if (!content.includes("import i18n from")) {
      const depth = filePath.split('/').length - 2;
      const i18nPath = '../'.repeat(Math.max(1, depth - 1)) + 'i18n';
      content = `import i18n from '${i18nPath}';\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ${filePath}: ${changes}`);
  }
  return changes;
}

const targets = [
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
