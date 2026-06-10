#!/usr/bin/env node
/**
 * i18n Wave 2: Process electron files + React files with JSX awareness
 * - Electron: import i18n + i18n.t('key') (same as wave1, works perfectly)
 * - React: Detect JSX context, wrap with {i18n.t()} in JSX, i18n.t() in code
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// ── Electron files to process (next 15 largest) ──
const electronFiles = [
  'electron/engine/analysis/template-compatibility-engine.ts',
  'electron/engine/analysis/technical-indicators.ts',
  'electron/data/data-provider.ts',
  'electron/engine/agents/nlp-sentiment-engine.ts',
  'electron/engine/core/i18n-engine.ts',
  'electron/engine/agents/ai-report-generator.ts',
  'electron/engine/analysis/live-trade-bridge.ts',
  'electron/engine/factors/factor-compatibility-engine.ts',
  'electron/engine/portfolio/rebalance-engine.ts',
  'electron/engine/data/trading-calendar.ts',
  'electron/engine/portfolio/parameter-smart-engine.ts',
  'electron/engine/agents/agent-macro.ts',
  'electron/engine/agents/agent-technical.ts',
  'electron/engine/agents/agent-fundamentals.ts',
  'electron/engine/agents/agent-sentiment.ts',
];

// ── React files to process ──
const reactFiles = [
  'src/components/tools/DataQualityPage.tsx',
  'src/components/strategy/StrategyPage.tsx',
  'src/components/ai/AgentCollaborationPanel.tsx',
  'src/components/billing/core/ThemeLangPanel.tsx',
  'src/components/risk/SentimentDashboardPage.tsx',
  'src/components/billing/core/UIAuditPanel.tsx',
];

const allFiles = [
  ...electronFiles.map(f => ({ path: f, type: 'electron' })),
  ...reactFiles.map(f => ({ path: f, type: 'react' })),
];

const keyCounters = {};
function nextKey(ns) {
  if (!keyCounters[ns]) keyCounters[ns] = 0;
  keyCounters[ns]++;
  return `${ns}.k${keyCounters[ns]}`;
}

function getI18nImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  let rel = path.relative(fileDir, 'src/i18n').replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function getNamespace(filePath) {
  const base = path.basename(filePath).replace(/\.(ts|tsx)$/, '');
  // Convert kebab-case to camelCase
  return base.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ── Smart Chinese replacement ──
function processFile(content, filePath, type) {
  const ns = getNamespace(filePath);
  const lines = content.split('\n');
  const translations = {};
  let inBlockComment = false;
  let inJsxReturn = false;
  let changed = false;

  // Track JSX context by indentation and return statements
  const newLines = lines.map((line, idx) => {
    // Track block comments
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return line;
    }
    if (line.trim().startsWith('//')) return line;
    if (line.trim().startsWith('/*')) {
      inBlockComment = !line.includes('*/');
      return line;
    }

    // Track JSX return blocks
    if (/^\s*return\s*\(/.test(line)) inJsxReturn = true;
    if (inJsxReturn && /\)\s*;?\s*$/.test(line.trim())) inJsxReturn = false;

    let newLine = line;
    const tFn = 'i18n.t';

    // For React files in JSX context, handle differently
    if (type === 'react' && inJsxReturn) {
      // JSX attribute: propName="Chinese..."  →  propName={i18n.t('key')}
      newLine = newLine.replace(/(\w+)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (match, prop, str) => {
        const key = nextKey(ns);
        translations[key] = str;
        changed = true;
        return `${prop}={${tFn}('${key}')}`;
      });

      // JSX text: >Chinese...< → >{i18n.t('key')}<
      newLine = newLine.replace(/>([^<{]*[\u4e00-\u9fff][^<]*)</g, (match, text) => {
        // Only if it's pure text (no JSX expressions)
        if (text.includes('{') || text.includes('}')) return match;
        const key = nextKey(ns);
        translations[key] = text.trim();
        changed = true;
        return `>{${tFn}('${key}')}<`;
      });
    }

    // Non-JSX context: regular string replacement
    // Double-quoted strings
    newLine = newLine.replace(/"([^"]*[\u4e00-\u9fff][^"]*)"/g, (match, str) => {
      const key = nextKey(ns);
      translations[key] = str;
      changed = true;
      return `${tFn}('${key}')`;
    });

    // Single-quoted strings (skip if already a t() call)
    newLine = newLine.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (match, str) => {
      if (match.includes(`${tFn}(`)) return match;
      const key = nextKey(ns);
      translations[key] = str;
      changed = true;
      return `${tFn}('${key}')`;
    });

    // Backtick strings
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

// ── Add i18n import ──
function addImport(content, filePath) {
  const importPath = getI18nImportPath(filePath);
  const importStmt = `import i18n from '${importPath}';`;
  if (content.includes(importStmt)) return content;
  
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importStmt);
  } else {
    lines.unshift(importStmt);
  }
  return lines.join('\n');
}

// ── Process all files ──
const allTranslations = {};
const results = [];

for (const file of allFiles) {
  const filePath = path.join(root, file.path);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${file.path} (not found)`);
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf-8');
  const { content: replaced, translations, changed } = processFile(original, file.path, file.type);

  if (!changed) {
    console.log(`SKIP: ${file.path} (no changes)`);
    continue;
  }

  let finalContent = addImport(replaced, file.path);
  fs.writeFileSync(filePath, finalContent, 'utf-8');

  const origCn = (original.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const newCn = (finalContent.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;

  Object.assign(allTranslations, translations);
  results.push({
    file: file.path,
    type: file.type,
    origCn,
    newCn,
    removed: origCn - newCn,
    keys: Object.keys(translations).length,
  });
}

// ── Summary ──
console.log('\n=== i18n Wave 2 Results ===');
let totalRemoved = 0;
results.forEach(r => {
  console.log(`  ${r.file}: ${r.origCn} → ${r.newCn} (-${r.removed}, ${r.keys} keys)`);
  totalRemoved += r.removed;
});
console.log(`\n  Total removed: ${totalRemoved} chars`);
console.log(`  Total keys: ${Object.keys(allTranslations).length}`);

// Save translations
const outPath = path.join(__dirname, 'i18n-wave2-translations.json');
fs.writeFileSync(outPath, JSON.stringify(allTranslations, null, 2), 'utf-8');
console.log(`  Saved to: ${outPath}`);
