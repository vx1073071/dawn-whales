#!/usr/bin/env node
/**
 * i18n Wave 2: Electron files ONLY (safe, no JSX issues)
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const files = [
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

const keyCounters = {};
function nextKey(ns) {
  if (!keyCounters[ns]) keyCounters[ns] = 0;
  keyCounters[ns]++;
  return `${ns}.k${keyCounters[ns]}`;
}

function getImportPath(fp) {
  let rel = path.relative(path.dirname(fp), 'src/i18n').replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function getNs(fp) {
  return path.basename(fp).replace(/\.(ts|tsx)$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const allT = {};
const results = [];

for (const file of files) {
  const fp = path.join(root, file);
  if (!fs.existsSync(fp)) { console.log(`SKIP: ${file}`); continue; }
  
  const ns = getNs(file);
  const orig = fs.readFileSync(fp, 'utf-8');
  const lines = orig.split('\n');
  let inBlock = false;
  let changed = false;
  const trans = {};

  const newLines = lines.map(line => {
    if (inBlock) { if (line.includes('*/')) inBlock = false; return line; }
    if (line.trim().startsWith('//')) return line;
    if (line.trim().startsWith('/*')) { inBlock = !line.includes('*/'); return line; }

    let nl = line;
    // Double quotes
    nl = nl.replace(/"([^"]*[\u4e00-\u9fff][^"]*)"/g, (m, s) => {
      const k = nextKey(ns); trans[k] = s; changed = true;
      return `i18n.t('${k}')`;
    });
    // Single quotes (not already t() calls)
    nl = nl.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (m, s) => {
      if (m.includes('i18n.t(')) return m;
      const k = nextKey(ns); trans[k] = s; changed = true;
      return `i18n.t('${k}')`;
    });
    // Backticks
    nl = nl.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (m, s) => {
      const k = nextKey(ns); trans[k] = s; changed = true;
      return `i18n.t('${k}')`;
    });
    return nl;
  });

  if (!changed) { console.log(`SKIP: ${file} (no Chinese)`); continue; }

  let content = newLines.join('\n');
  // Add i18n import
  const imp = `import i18n from '${getImportPath(file)}';`;
  if (!content.includes(imp)) {
    const ls = content.split('\n');
    let last = -1;
    for (let i = 0; i < ls.length; i++) if (ls[i].startsWith('import ')) last = i;
    ls.splice(last + 1, 0, imp);
    content = ls.join('\n');
  }

  fs.writeFileSync(fp, content, 'utf-8');
  const origCn = (orig.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const newCn = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  Object.assign(allT, trans);
  results.push({ file, origCn, newCn, removed: origCn - newCn, keys: Object.keys(trans).length });
}

console.log('\n=== Wave 2 Electron Results ===');
let total = 0;
results.forEach(r => {
  console.log(`  ${r.file}: ${r.origCn} → ${r.newCn} (-${r.removed}, ${r.keys} keys)`);
  total += r.removed;
});
console.log(`\n  Total removed: ${total} chars | Keys: ${Object.keys(allT).length}`);

fs.writeFileSync(path.join(__dirname, 'i18n-wave2-translations.json'), JSON.stringify(allT, null, 2), 'utf-8');
console.log('  Translations saved.');
