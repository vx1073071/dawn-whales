#!/usr/bin/env node
/**
 * i18n React Wave: JSX-aware replacement for React component files
 * - JSX attributes: title="中文" → title={i18n.t('key')}
 * - JSX text: >中文< → >{i18n.t('key')}<
 * - Code strings: '中文' → i18n.t('key')
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const files = [
  'src/components/billing/onboarding/OnboardingFullKit.tsx',
  'src/components/billing/core/HelpCenter.tsx',
  'src/components/billing/core/LandingPageV18.tsx',
  'src/components/dashboard/AIDailyDigestPanel.tsx',
  'src/components/ai/AIAssistantPanel.tsx',
  'src/components/tools/DataQualityPage.tsx',
  'src/components/strategy/StrategyPage.tsx',
  'src/components/ai/AgentCollaborationPanel.tsx',
  'src/components/billing/core/ThemeLangPanel.tsx',
  'src/components/risk/SentimentDashboardPage.tsx',
  'src/components/billing/core/UIAuditPanel.tsx',
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

    // Phase 1: JSX attribute patterns (must be done FIRST before general replacement)
    // Match: propName="Chinese text"  →  propName={i18n.t('key')}
    nl = nl.replace(/(\w+)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (m, prop, str) => {
      // Skip if prop is 'className', 'style', 'src', 'href' etc (non-text props)
      if (['className', 'style', 'src', 'href', 'onClick', 'onChange', 'id', 'key', 'ref', 'type', 'name', 'method', 'target', 'rel'].includes(prop)) return m;
      const k = nextKey(ns);
      trans[k] = str;
      changed = true;
      return `${prop}={i18n.t('${k}')}`;
    });

    // Phase 2: JSX text content: >Chinese< → >{i18n.t('key')}<
    // Only match when > is immediately followed by Chinese text and then <
    nl = nl.replace(/>([^<>{}\n]*[\u4e00-\u9fff][^<>{}\n]*)</g, (m, text) => {
      const trimmed = text.trim();
      if (!trimmed) return m;
      const k = nextKey(ns);
      trans[k] = trimmed;
      changed = true;
      return `>{i18n.t('${k}')}<`;
    });

    // Phase 3: Remaining double-quoted strings with Chinese (code context)
    nl = nl.replace(/"([^"]*[\u4e00-\u9fff][^"]*)"/g, (m, str) => {
      if (m.includes("i18n.t(")) return m;
      const k = nextKey(ns);
      trans[k] = str;
      changed = true;
      return `i18n.t('${k}')`;
    });

    // Phase 4: Single-quoted strings with Chinese
    nl = nl.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (m, str) => {
      if (m.includes("i18n.t(")) return m;
      const k = nextKey(ns);
      trans[k] = str;
      changed = true;
      return `i18n.t('${k}')`;
    });

    // Phase 5: Backtick strings with Chinese
    nl = nl.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (m, str) => {
      if (m.includes("i18n.t(")) return m;
      const k = nextKey(ns);
      trans[k] = str;
      changed = true;
      return `i18n.t('${k}')`;
    });

    return nl;
  });

  if (!changed) { console.log(`SKIP: ${file} (no changes)`); continue; }

  let content = newLines.join('\n');
  
  // Add i18n import if not already there
  const imp = `import i18n from '${getImportPath(file)}';`;
  if (!content.includes("import i18n from '")) {
    const ls = content.split('\n');
    let last = -1;
    for (let i = 0; i < ls.length; i++) if (ls[i].startsWith('import ')) last = i;
    ls.splice(Math.max(last + 1, 0), 0, imp);
    content = ls.join('\n');
  }

  fs.writeFileSync(fp, content, 'utf-8');
  const origCn = (orig.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const newCn = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  Object.assign(allT, trans);
  results.push({ file, origCn, newCn, removed: origCn - newCn, keys: Object.keys(trans).length });
}

console.log('\n=== React Wave Results ===');
let total = 0;
results.forEach(r => {
  console.log(`  ${r.file}: ${r.origCn} → ${r.newCn} (-${r.removed}, ${r.keys} keys)`);
  total += r.removed;
});
console.log(`\n  Total removed: ${total} chars | Keys: ${Object.keys(allT).length} | Files: ${results.length}`);

fs.writeFileSync(path.join(__dirname, 'i18n-react-translations.json'), JSON.stringify(allT, null, 2), 'utf-8');
console.log('  Translations saved.');
