#!/usr/bin/env node
/**
 * i18n React Wave v2: Fixed nested quote issue
 * Strategy: 
 *   1. Find ALL string literals (', ", `) containing Chinese
 *   2. Replace with unique placeholder (avoids nested quote issues)
 *   3. Replace placeholders with i18n.t() or {i18n.t()} depending on context
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
  let placeholderIdx = 0;

  // Process line by line
  const newLines = lines.map(line => {
    if (inBlock) { if (line.includes('*/')) inBlock = false; return line; }
    if (line.trim().startsWith('//')) return line;
    if (line.trim().startsWith('/*')) { inBlock = !line.includes('*/'); return line; }

    // Skip lines without Chinese
    if (!/[\u4e00-\u9fff]/.test(line)) return line;

    // Step 1: Find all string literals with Chinese and replace with placeholders
    // We need to track which quote type each string uses
    const placeholders = [];
    let processed = line;

    // Find backtick strings first (they can contain quotes)
    processed = processed.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (m, content) => {
      const ph = `__PH${placeholderIdx++}__`;
      placeholders.push({ ph, content, quote: '`' });
      return ph;
    });

    // Find double-quoted strings with Chinese
    processed = processed.replace(/"([^"]*[\u4e00-\u9fff][^"]*)"/g, (m, content) => {
      const ph = `__PH${placeholderIdx++}__`;
      placeholders.push({ ph, content, quote: '"' });
      return ph;
    });

    // Find single-quoted strings with Chinese
    processed = processed.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (m, content) => {
      const ph = `__PH${placeholderIdx++}__`;
      placeholders.push({ ph, content, quote: "'" });
      return ph;
    });

    // Step 2: Replace placeholders with i18n.t() calls
    // Detect context: is the placeholder in JSX attribute or JSX text?
    for (const { ph, content } of placeholders) {
      const k = nextKey(ns);
      trans[k] = content;
      changed = true;

      // Check if placeholder is in JSX attribute: propName=__PH__
      const attrMatch = processed.match(new RegExp(`(\\w+)=${ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      if (attrMatch) {
        const prop = attrMatch[1];
        if (!['className', 'style', 'src', 'href', 'onClick', 'onChange', 'id', 'key', 'ref', 'type', 'name'].includes(prop)) {
          processed = processed.replace(`${attrMatch[0]}`, `${prop}={i18n.t('${k}')}`);
          continue;
        }
      }

      // Check if placeholder is in JSX text: >__PH__<
      if (processed.includes(`>${ph}<`)) {
        processed = processed.replace(`>${ph}<`, `>{i18n.t('${k}')}<`);
        continue;
      }

      // Default: code context
      processed = processed.replace(ph, `i18n.t('${k}')`);
    }

    return processed;
  });

  if (!changed) { console.log(`SKIP: ${file}`); continue; }

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

console.log('\n=== React Wave v2 Results ===');
let total = 0;
results.forEach(r => {
  console.log(`  ${r.file}: ${r.origCn} → ${r.newCn} (-${r.removed}, ${r.keys} keys)`);
  total += r.removed;
});
console.log(`\n  Total removed: ${total} chars | Keys: ${Object.keys(allT).length} | Files: ${results.length}`);

fs.writeFileSync(path.join(__dirname, 'i18n-react-v2-translations.json'), JSON.stringify(allT, null, 2), 'utf-8');
console.log('  Translations saved.');
