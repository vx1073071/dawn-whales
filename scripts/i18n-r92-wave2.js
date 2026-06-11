// R92 Wave 2: Aggressive CJK removal from src JSX files
// Strategy: For each CJK text segment in JSX, replace with {i18n.t('Component.r92k_N')}
// Handle: plain text, text mixed with emoji, text with HTML entities
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const CJK_G = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

function countCJK(text) {
  const m = text.match(CJK_G);
  return m ? m.length : 0;
}

// Generate i18n key from CJK text
function makeKey(componentName, idx) {
  return `${componentName}.w2_${idx}`;
}

function processFile(filePath, componentName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let keyIdx = 0;
  const newKeys = {};
  let changes = 0;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Skip if no CJK
    if (!CJK.test(trimmed)) {
      newLines.push(line);
      continue;
    }

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      newLines.push(line);
      continue;
    }

    // Skip regex patterns
    if (trimmed.match(/\/[^/]*[\u4e00-\u9fff][^/]*\//)) {
      newLines.push(line);
      continue;
    }

    // Skip import/export
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      newLines.push(line);
      continue;
    }

    // Skip if inside i18n locale JSON data
    if (filePath.includes('locales/')) {
      newLines.push(line);
      continue;
    }

    let newLine = line;

    // Pattern: JSX text between > and < that contains CJK
    // Match: >TEXT_WITH_CJK<  but NOT >{expression}<
    // Handle multi-segment: >emoji TEXT {expr} TEXT<
    const jsxRe = />([^<]*[\u4e00-\u9fff][^<]*)</g;
    let match;
    const replacements = [];

    while ((match = jsxRe.exec(newLine)) !== null) {
      const fullText = match[1];
      const textIdx = match.index + 1; // position after >

      // Check if it's a pure text (no JSX expressions)
      if (!/\{[^}]*\}/.test(fullText)) {
        // Pure text - replace entire content
        const key = makeKey(componentName, keyIdx);
        newKeys[key] = fullText.trim();
        replacements.push({
          start: textIdx,
          end: textIdx + fullText.length,
          replacement: `{i18n.t('${key}')}`,
        });
        keyIdx++;
        changes++;
      } else {
        // Mixed text with expressions - extract CJK segments
        // Split by {expression} and replace CJK text parts
        const parts = fullText.split(/(\{[^}]*\})/);
        let offset = textIdx;
        for (const part of parts) {
          if (part.startsWith('{') && part.endsWith('}')) {
            offset += part.length;
            continue;
          }
          if (CJK.test(part)) {
            const key = makeKey(componentName, keyIdx);
            newKeys[key] = part.trim();
            replacements.push({
              start: offset,
              end: offset + part.length,
              replacement: `{i18n.t('${key}')}`,
            });
            keyIdx++;
            changes++;
          }
          offset += part.length;
        }
      }
    }

    // Apply replacements in reverse order (to preserve indices)
    if (replacements.length > 0) {
      const chars = [...newLine];
      for (const r of replacements.reverse()) {
        const before = newLine.substring(0, r.start);
        const after = newLine.substring(r.end);
        newLine = before + r.replacement + after;
      }
    }

    // Pattern: String literals with CJK (not in JSX)
    // '中文文本' or "中文文本" that aren't inside i18n.t()
    if (CJK.test(newLine)) {
      const strRe = /(['"])([^'"\n]*[\u4e00-\u9fff][^'"\n]*)\1/g;
      let strMatch;
      const strReplacements = [];
      while ((strMatch = strRe.exec(newLine)) !== null) {
        const before = newLine.substring(0, strMatch.index);
        // Skip if inside i18n.t()
        if (before.endsWith("i18n.t(") || before.endsWith("t(")) continue;
        // Skip if it looks like a regex
        if (before.endsWith('/') || before.match(/\/[^/]*$/)) continue;
        // Skip if it's a file path or URL
        const text = strMatch[2];
        if (text.includes('/') || text.includes('\\') || text.includes('http')) continue;
        // Skip if it's an object key pattern like { '中文': value }
        if (newLine.substring(strMatch.index + strMatch[0].length).trimStart().startsWith(':')) continue;

        const key = makeKey(componentName, keyIdx);
        newKeys[key] = text;
        strReplacements.push({
          from: strMatch[0],
          to: `i18n.t('${key}')`,
        });
        keyIdx++;
        changes++;
      }
      for (const r of strReplacements) {
        newLine = newLine.replace(r.from, r.to);
      }
    }

    newLines.push(newLine);
  }

  if (changes > 0) {
    // Ensure i18n import exists
    const result = newLines.join('\n');
    if (!result.includes("import i18n from") && !result.includes("from '../i18n'") && !result.includes("from '../../i18n'")) {
      // Add import after first import
      const importIdx = result.indexOf("import ");
      if (importIdx >= 0) {
        const lineEnd = result.indexOf('\n', importIdx);
        const depth = filePath.split('/').length - 2; // src/components/x/file.tsx → depth
        const i18nPath = '../'.repeat(Math.max(1, depth - 1)) + 'i18n';
        const importLine = `\nimport i18n from '${i18nPath}';`;
        fs.writeFileSync(filePath, result.substring(0, lineEnd) + importLine + result.substring(lineEnd), 'utf8');
      } else {
        fs.writeFileSync(filePath, result, 'utf8');
      }
    } else {
      fs.writeFileSync(filePath, result, 'utf8');
    }
  }
  return { changes, newKeys };
}

// Process top src files
const targets = [
  'src/components/billing/onboarding/OnboardingFullKit.tsx',
  'src/components/billing/core/GAFinalPanel.tsx',
  'src/components/billing/ai/AIDrawingPatternPanel.tsx',
  'src/components/marketplace/MarketplacePage.tsx',
  'src/components/billing/trade/DataSourcePanel.tsx',
  'src/components/tools/DataExportPage.tsx',
  'src/components/billing/market/BacktestPerformancePanel.tsx',
  'src/components/dashboard/DesktopNotificationPanel.tsx',
  'src/components/billing/core/LandingPageV18.tsx',
  'src/components/billing/trade/IBKRBrokerPanel.tsx',
  'src/components/billing/core/GuestModeShell.tsx',
  'src/components/billing/wallet/USDTPaymentPanel.tsx',
  'src/components/billing/community/CreatorLeaderboard.tsx',
  'src/components/billing/wallet/P2PBlacklistPanel.tsx',
  'src/components/strategy/StrategyOptimizerPanel.tsx',
  'src/components/backtest/BacktestReportPage.tsx',
  'src/components/billing/core/UIAuditPanel.tsx',
  'src/components/billing/core/DesktopShell.tsx',
  'src/components/strategy/StrategyImportExportUI.tsx',
  'src/components/billing/core/UIPolishKit.tsx',
  'src/components/billing/core/HelpCenter.tsx',
  'src/components/risk/NotificationCenter.tsx',
  'src/components/billing/core/DownloadPage.tsx',
  'src/components/billing/core/DesktopCleanupShell.tsx',
  'src/components/billing/wallet/P2PTransferPage.tsx',
  'src/components/billing/wallet/SecurityCenter.tsx',
  'src/components/billing/wallet/DisputeCenter.tsx',
  'src/components/billing/community/GrowthPanel.tsx',
  'src/components/billing/trade/FractionalTradePanel.tsx',
  'src/components/billing/ai/AIBillingPanel.tsx',
];

let totalChanges = 0;
const allKeys = {};

for (const f of targets) {
  if (!fs.existsSync(f)) continue;
  const name = path.basename(f, '.tsx').replace(/[^a-zA-Z0-9]/g, '');
  const { changes, newKeys } = processFile(f, name);
  if (changes > 0) {
    console.log(`  ${f}: ${changes} replacements`);
    totalChanges += changes;
    Object.assign(allKeys, newKeys);
  }
}

console.log(`\nTotal: ${totalChanges} replacements, ${Object.keys(allKeys).length} new keys`);

// Add to locale files
if (Object.keys(allKeys).length > 0) {
  const localeFiles = ['zh-CN.json', 'en.json', 'zh-HK.json', 'zh-TW.json', 'ja.json', 'ko.json', 'fr.json', 'it.json', 'de.json'];
  for (const locFile of localeFiles) {
    const locPath = `src/i18n/locales/${locFile}`;
    if (!fs.existsSync(locPath)) continue;
    const loc = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    for (const [key, value] of Object.entries(allKeys)) {
      const [comp, k] = key.split('.');
      if (!loc[comp]) loc[comp] = {};
      loc[comp][k] = value;
    }
    fs.writeFileSync(locPath, JSON.stringify(loc, null, 2) + '\n', 'utf8');
  }
  console.log(`Added keys to ${localeFiles.length} locale files`);
}

fs.writeFileSync('scripts/i18n-r92-wave2-keys.json', JSON.stringify(allKeys, null, 2));
