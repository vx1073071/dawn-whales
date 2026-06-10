#!/usr/bin/env node
/**
 * i18n React via i18n singleton: import i18n + i18n.t('key')
 * Works at module level AND component level (no hook needed)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const FILES = [
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

const CN = /[\u4e00-\u9fff]/;
function getNs(f) { return path.basename(f).replace(/\.(ts|tsx)$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
function getRelPath(f) {
  const d = path.dirname(f);
  let r = path.relative(d, 'src/i18n').replace(/\\/g, '/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

const SKIP_PROPS = new Set(['className','style','src','href','onClick','onChange','onSubmit','onInput','onBlur','onFocus','id','key','ref','type','name','method','target','rel','role','htmlFor','as','icon','color','verdictColor','data-testid','aria-label','alt','placeholder']);

const allT = {};
const kc = {};
function nk(ns) { if (!kc[ns]) kc[ns] = 0; return `${ns}.k${++kc[ns]}`; }

const results = [];

for (const file of FILES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) continue;
  
  const ns = getNs(file);
  const orig = fs.readFileSync(fp, 'utf8');
  const origCn = (orig.match(/[\u4e00-\u9fff]/g) || []).length;
  
  // Phase 1: Extract all string literals with positions
  const strings = [];
  let i = 0;
  while (i < orig.length) {
    const ch = orig[i];
    // Skip comments
    if (ch === '/' && orig[i+1] === '/') { while (i < orig.length && orig[i] !== '\n') i++; continue; }
    if (ch === '/' && orig[i+1] === '*') { i = orig.indexOf('*/', i+2); if (i === -1) break; i += 2; continue; }
    // String literal
    if (ch === '"' || ch === "'") {
      const q = ch;
      const start = i;
      let val = '';
      let j = i + 1;
      while (j < orig.length) {
        if (orig[j] === '\\') { val += orig[j] + orig[j+1]; j += 2; continue; }
        if (orig[j] === q) break;
        val += orig[j];
        j++;
      }
      if (j < orig.length) {
        strings.push({ start, end: j+1, value: val, quote: q });
      }
      i = j + 1;
      continue;
    }
    // Skip template literals
    if (ch === '`') {
      let j = i + 1;
      while (j < orig.length && orig[j] !== '`') { if (orig[j] === '\\') j++; j++; }
      i = j + 1;
      continue;
    }
    i++;
  }
  
  // Phase 2: Replace Chinese strings with i18n.t('key')
  const cnStrings = strings.filter(s => CN.test(s.value));
  if (cnStrings.length === 0) { console.log(`SKIP: ${file}`); continue; }
  
  const replacements = [];
  const trans = {};
  
  for (const s of cnStrings) {
    const key = nk(ns);
    trans[key] = s.value;
    
    // Check context for JSX attribute
    const before = orig.slice(Math.max(0, s.start - 80), s.start);
    const attrMatch = before.match(/(\w+)=$/);
    
    if (attrMatch && !SKIP_PROPS.has(attrMatch[1])) {
      // JSX attr: prop="Chinese" → prop={i18n.t('key')}
      const prop = attrMatch[1];
      replacements.push({
        start: s.start - prop.length - 1, // include prop=
        end: s.end,
        replacement: `${prop}={i18n.t('${key}')}`
      });
    } else if (attrMatch && SKIP_PROPS.has(attrMatch[1])) {
      // Skip this prop (className, style, etc.)
      delete trans[key]; kc[ns]--;
      continue;
    } else {
      // Regular string: "Chinese" → i18n.t('key')
      replacements.push({
        start: s.start,
        end: s.end,
        replacement: `i18n.t('${key}')`
      });
    }
  }
  
  // Phase 3: Apply replacements (end to start)
  let result = orig;
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  
  // Phase 4: Add i18n import
  const relPath = getRelPath(file);
  const importStmt = `import i18n from '${relPath}';`;
  if (!result.includes("import i18n from")) {
    const lines = result.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, importStmt);
    result = lines.join('\n');
  }
  
  fs.writeFileSync(fp, result, 'utf8');
  const newCn = (result.match(/[\u4e00-\u9fff]/g) || []).length;
  const removed = origCn - newCn;
  Object.assign(allT, trans);
  results.push({ file, origCn, newCn, removed, keys: Object.keys(trans).length });
}

console.log('\n=== React i18n.t() Results ===');
let total = 0;
for (const r of results) {
  console.log(`  ${r.file}: ${r.origCn}→${r.newCn} (-${r.removed}, ${r.keys} keys)`);
  total += r.removed;
}
console.log(`\n  Total: -${total} chars, ${Object.keys(allT).length} keys`);
fs.writeFileSync(path.join(__dirname, 'i18n-react-i18nimport-translations.json'), JSON.stringify(allT, null, 2));
