#!/usr/bin/env node
/**
 * i18n Wave 1: Replace hardcoded Chinese in top 10 files
 * - Electron files: import i18n + i18n.t('key')
 * - React files: useTranslation() + t('key'), move module-level arrays inside component
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cnRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;

// ── File configs ──
const files = [
  { path: 'electron/engine/agents/nl-parser.ts', type: 'electron', ns: 'nlParser' },
  { path: 'src/components/billing/onboarding/OnboardingFullKit.tsx', type: 'react', ns: 'onboarding' },
  { path: 'electron/engine/analysis/strategy-templates.ts', type: 'electron', ns: 'strategyTemplates' },
  { path: 'src/components/billing/core/HelpCenter.tsx', type: 'react', ns: 'helpCenter' },
  { path: 'src/components/billing/core/LandingPageV18.tsx', type: 'react', ns: 'landing' },
  { path: 'electron/engine/risk/risk-engine.ts', type: 'electron', ns: 'riskEngine' },
  { path: 'electron/data/marketplace-service.ts', type: 'electron', ns: 'marketplace' },
  { path: 'src/components/dashboard/AIDailyDigestPanel.tsx', type: 'react', ns: 'dailyDigest' },
  { path: 'src/components/ai/AIAssistantPanel.tsx', type: 'react', ns: 'aiAssistant' },
  { path: 'electron/engine/risk/compliance-report-engine.ts', type: 'electron', ns: 'compliance' },
];

// ── Key counter per namespace ──
const keyCounters = {};
function nextKey(ns) {
  if (!keyCounters[ns]) keyCounters[ns] = 0;
  keyCounters[ns]++;
  return `${ns}.k${keyCounters[ns]}`;
}

// ── Generate i18n import path from file to src/i18n ──
function getI18nImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const i18nDir = 'src/i18n';
  let rel = path.relative(fileDir, i18nDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// ── Extract Chinese strings, skipping comments ──
function processContent(content, tFn, ns) {
  const lines = content.split('\n');
  const translations = {};
  let inBlockComment = false;
  let changed = false;

  const newLines = lines.map((line, idx) => {
    // Track block comments
    if (inBlockComment) {
      if (line.includes('*/')) { inBlockComment = false; }
      return line;
    }
    if (line.trim().startsWith('//')) return line;
    if (line.trim().startsWith('/*')) {
      inBlockComment = !line.includes('*/');
      return line;
    }

    // Replace Chinese in string literals only
    let newLine = line;

    // Double-quoted strings with Chinese
    newLine = newLine.replace(/"([^"]*[\u4e00-\u9fff][^"]*)"/g, (match, str) => {
      const key = nextKey(ns);
      translations[key] = str;
      changed = true;
      return `${tFn}('${key}')`;
    });

    // Single-quoted strings with Chinese (but not template keys)
    newLine = newLine.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (match, str) => {
      // Skip if this is already a t('key') call
      if (match.includes(`${tFn}(`)) return match;
      const key = nextKey(ns);
      translations[key] = str;
      changed = true;
      return `${tFn}('${key}')`;
    });

    // Backtick strings with Chinese
    newLine = newLine.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (match, str) => {
      const key = nextKey(ns);
      translations[key] = str;
      changed = true;
      return `${tFn}('${key}')`;
    });

    return newLine;
  });

  return { content: newLines.join('\n'), translations, changed };
}

// ── Add import to electron file ──
function addElectronImport(content, filePath) {
  const importPath = getI18nImportPath(filePath);
  const importStmt = `import i18n from '${importPath}';`;
  if (content.includes(importStmt) || content.includes("from 'src/i18n'")) return content;
  
  // Add after the last import statement
  const importLines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].startsWith('import ') || importLines[i].startsWith('const ') && importLines[i].includes('require(')) {
      lastImportIdx = i;
    }
  }
  if (lastImportIdx >= 0) {
    importLines.splice(lastImportIdx + 1, 0, importStmt);
  } else {
    importLines.unshift(importStmt);
  }
  return importLines.join('\n');
}

// ── Process all files ──
const allTranslations = {};
const results = [];

for (const file of files) {
  const filePath = path.join(root, file.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${file.path} (not found)`);
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf-8');
  const tFn = file.type === 'electron' ? 'i18n.t' : 'i18n.t'; // Use i18n.t for all (module-level safe)
  const { content: replaced, translations, changed } = processContent(original, tFn, file.ns);

  if (!changed) {
    console.log(`SKIP: ${file.path} (no changes)`);
    continue;
  }

  let finalContent = replaced;

  // Add i18n import for electron files
  if (file.type === 'electron') {
    finalContent = addElectronImport(finalContent, file.path);
  }

  // Save modified file
  fs.writeFileSync(filePath, finalContent, 'utf-8');

  // Count Chinese chars
  const origCn = (original.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const newCn = (finalContent.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const removed = origCn - newCn;

  // Collect translations
  Object.assign(allTranslations, translations);

  results.push({
    file: file.path,
    type: file.type,
    ns: file.ns,
    origCn,
    newCn,
    removed,
    keys: Object.keys(translations).length,
  });
}

// ── Summary ──
console.log('\n=== i18n Wave 1 Results ===');
let totalRemoved = 0;
results.forEach(r => {
  console.log(`  ${r.file}: ${r.origCn} → ${r.newCn} (-${r.removed} chars, ${r.keys} keys)`);
  totalRemoved += r.removed;
});
console.log(`\n  Total removed: ${totalRemoved} chars`);
console.log(`  Total keys: ${Object.keys(allTranslations).length}`);

// ── Save translations to JSON ──
const translationsPath = path.join(root, 'scripts', 'i18n-wave1-translations.json');
fs.writeFileSync(translationsPath, JSON.stringify(allTranslations, null, 2), 'utf-8');
console.log(`\n  Translations saved to: ${translationsPath}`);

// ── Count remaining Chinese ──
const scanScript = path.join(root, 'scripts', 'i18n-scan.js');
console.log('\n  Run `node scripts/i18n-scan.js` to verify remaining Chinese chars.');
