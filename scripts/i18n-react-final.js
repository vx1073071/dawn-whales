#!/usr/bin/env node
/**
 * i18n React Final: Scope-aware string replacement
 * 
 * Strategy:
 * - Module-level const data → move INSIDE component wrapped in useMemo
 * - Component-level strings → replace with t('key')  
 * - JSX attributes → {t('key')}
 * - JSX text → >{t('key')}<
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

// Character-level string extractor
function extractStrings(content) {
  const strings = []; // { start, end, value, quote }
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    // Skip comments
    if (ch === '/' && content[i + 1] === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && content[i + 1] === '*') {
      i = content.indexOf('*/', i + 2);
      if (i === -1) break;
      i += 2;
      continue;
    }
    // String literal
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      let val = '';
      let j = i + 1;
      while (j < content.length) {
        if (content[j] === '\\') { val += content[j] + content[j + 1]; j += 2; continue; }
        if (content[j] === quote) break;
        val += content[j];
        j++;
      }
      if (j < content.length) {
        strings.push({ start, end: j + 1, value: val, quote });
      }
      i = j + 1;
      continue;
    }
    // Skip template literals entirely (too complex)
    if (ch === '`') {
      let j = i + 1;
      while (j < content.length && content[j] !== '`') {
        if (content[j] === '\\') j++;
        j++;
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return strings;
}

// Determine if a position is inside a React component/hook function
function isInsideComponent(content, pos) {
  // Find the enclosing function by scanning backwards for function/=> keywords
  const before = content.slice(0, pos);
  // Simple heuristic: if we're inside a function that has useTranslation or is a React component
  // Count function boundaries
  let depth = 0;
  let inFunc = false;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === '}') depth++;
    if (before[i] === '{') {
      depth--;
      if (depth < 0) {
        // Found the opening brace of an enclosing block
        const preceding = before.slice(Math.max(0, i - 200), i).trim();
        if (preceding.match(/(function\s+\w+|const\s+\w+\s*=\s*(\([^)]*\)|[^=])\s*=>)/)) {
          inFunc = true;
          break;
        }
        depth = 0;
      }
    }
  }
  return inFunc;
}

function getNs(file) {
  return path.basename(file).replace(/\.(ts|tsx)$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function getI18nPath(file) {
  const dir = path.dirname(file);
  let rel = path.relative(dir, 'src/i18n').replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// ── Main processing ──
const allTranslations = {};
const keyCounters = {};

function nextKey(ns) {
  if (!keyCounters[ns]) keyCounters[ns] = 0;
  keyCounters[ns]++;
  return `${ns}.k${keyCounters[ns]}`;
}

const results = [];

for (const file of FILES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { console.log(`SKIP: ${file}`); continue; }
  
  const ns = getNs(file);
  const orig = fs.readFileSync(fp, 'utf8');
  const origCn = (orig.match(/[\u4e00-\u9fff]/g) || []).length;
  const strings = extractStrings(orig);
  
  // Filter to Chinese strings only
  const cnStrings = strings.filter(s => CN.test(s.value));
  
  if (cnStrings.length === 0) {
    console.log(`SKIP: ${file} (no Chinese strings)`);
    continue;
  }

  // Build replacement map: process from END to START to preserve positions
  const replacements = []; // { start, end, replacement }
  const trans = {};
  
  // Categorize each string
  let moduleLevelCount = 0;
  let componentLevelCount = 0;
  
  for (const s of cnStrings) {
    const key = nextKey(ns);
    trans[key] = s.value;
    
    // Check context: look at 100 chars before the string
    const contextBefore = orig.slice(Math.max(0, s.start - 100), s.start);
    
    // JSX attribute: propName="Chinese"
    const attrMatch = contextBefore.match(/(\w+)=$/);
    if (attrMatch) {
      const prop = attrMatch[1];
      const skipProps = ['className', 'style', 'src', 'href', 'onClick', 'onChange', 'onSubmit', 'id', 'key', 'ref', 'type', 'name', 'method', 'target', 'rel', 'role', 'htmlFor', 'as', 'icon'];
      if (!skipProps.includes(prop)) {
        // Replace: propName="Chinese" → propName={t('key')}
        // Need to include the = in the replacement
        replacements.push({
          start: s.start - prop.length - 1, // include propName=
          end: s.end,
          replacement: `${prop}={t('${key}')}`
        });
        componentLevelCount++;
        continue;
      }
    }
    
    // JSX text: >Chinese<
    if (contextBefore.endsWith('>') && orig[s.end] === '<') {
      replacements.push({
        start: s.start,
        end: s.end,
        replacement: `{t('${key}')}`
      });
      componentLevelCount++;
      continue;
    }
    
    // Check if module-level (before any function declaration)
    const firstFuncIdx = orig.search(/^(export\s+)?(function|const\s+\w+\s*=\s*(\(|[a-z]))/m);
    const isModuleLevel = s.start < firstFuncIdx || !isInsideComponent(orig, s.start);
    
    if (isModuleLevel) {
      // DON'T replace module-level strings — they'll need manual handling
      moduleLevelCount++;
      // Remove the key we just created since we won't use it
      delete trans[key];
      keyCounters[ns]--;
    } else {
      // Component-level: replace with t('key')
      replacements.push({
        start: s.start,
        end: s.end,
        replacement: `t('${key}')`
      });
      componentLevelCount++;
    }
  }

  if (replacements.length === 0) {
    console.log(`SKIP: ${file} (all ${moduleLevelCount} strings at module level)`);
    continue;
  }

  // Apply replacements from end to start
  let result = orig;
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }

  // Add useTranslation import if not present
  if (!result.includes('useTranslation') && Object.keys(trans).length > 0) {
    result = result.replace(
      /(import\s+{[^}]*}\s+from\s+'react';?\n)/,
      "$1import { useTranslation } from 'react-i18next';\n"
    );
    if (!result.includes('useTranslation')) {
      result = "import { useTranslation } from 'react-i18next';\n" + result;
    }
  }

  // Add const { t } = useTranslation() inside component functions
  // Find exported default function or main component function
  if (!result.includes('const { t } = useTranslation()')) {
    // Pattern 1: export default function Name(
    result = result.replace(
      /(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*{)/,
      "$1\n  const { t } = useTranslation();"
    );
    // Pattern 2: function Name( ... ) { (first non-exported function that returns JSX)
    if (!result.includes('const { t } = useTranslation()')) {
      result = result.replace(
        /(function\s+\w+\s*\([^)]*\)\s*{)(?!.*const \{ t \})/,
        "$1\n  const { t } = useTranslation();"
      );
    }
  }

  fs.writeFileSync(fp, result, 'utf8');
  const newCn = (result.match(/[\u4e00-\u9fff]/g) || []).length;
  const removed = origCn - newCn;
  Object.assign(allTranslations, trans);
  results.push({ file, origCn, newCn, removed, keys: Object.keys(trans).length, moduleSkipped: moduleLevelCount });
}

console.log('\n=== React Final Results ===');
let totalRemoved = 0;
for (const r of results) {
  console.log(`  ${r.file}: ${r.origCn}→${r.newCn} (-${r.removed}, ${r.keys} keys, ${r.moduleSkipped} module-level skipped)`);
  totalRemoved += r.removed;
}
console.log(`\n  Total removed: ${totalRemoved} chars | Keys: ${Object.keys(allTranslations).length}`);

// Save translations
fs.writeFileSync(path.join(__dirname, 'i18n-react-final-translations.json'), JSON.stringify(allTranslations, null, 2));
console.log('  Translations saved.');
