#!/usr/bin/env node
/**
 * i18n React Safe: Brace-depth-based scope detection
 * depth=0 → module level → SKIP
 * depth>0 → inside function → REPLACE with t('key')
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

const allT = {};
const kc = {};
function nk(ns) { if (!kc[ns]) kc[ns] = 0; return `${ns}.k${++kc[ns]}`; }

const SKIP_PROPS = new Set(['className','style','src','href','onClick','onChange','onSubmit','id','key','ref','type','name','method','target','rel','role','htmlFor','as','icon','color','verdictColor']);

const results = [];

for (const file of FILES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) continue;
  
  const ns = getNs(file);
  const orig = fs.readFileSync(fp, 'utf8');
  const origCn = (orig.match(/[\u4e00-\u9fff]/g) || []).length;
  
  // Phase 1: Walk through the file, track brace depth, find Chinese strings
  const replacements = []; // {start, end, replacement}
  const trans = {};
  let depth = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inString = false;
  let stringQuote = '';
  let stringStart = -1;
  let i = 0;
  let skipped = 0;
  
  while (i < orig.length) {
    const ch = orig[i];
    
    // Handle comments
    if (!inString && !inBlockComment && ch === '/' && orig[i+1] === '/') {
      while (i < orig.length && orig[i] !== '\n') i++;
      inLineComment = false;
      continue;
    }
    if (!inString && !inLineComment && ch === '/' && orig[i+1] === '*') {
      i += 2;
      while (i < orig.length - 1 && !(orig[i] === '*' && orig[i+1] === '/')) i++;
      i += 2;
      continue;
    }
    
    // Handle string literals
    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      stringQuote = ch;
      stringStart = i;
      i++;
      continue;
    }
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === stringQuote) {
        // End of string
        inString = false;
        const strValue = orig.slice(stringStart + 1, i);
        
        if (CN.test(strValue) && depth > 0) {
          // Inside a function — replace
          const key = nk(ns);
          trans[key] = strValue;
          
          // Check context
          const before = orig.slice(Math.max(0, stringStart - 80), stringStart);
          const after = orig[i + 1];
          
          const attrMatch = before.match(/(\w+)=$/);
          if (attrMatch && !SKIP_PROPS.has(attrMatch[1])) {
            // JSX attr: prop="Chinese" → prop={t('key')}
            const prop = attrMatch[1];
            replacements.push({ start: stringStart - prop.length - 1, end: i + 1, replacement: `${prop}={t('${key}')}` });
          } else if (before.endsWith('>') && after === '<') {
            // JSX text: >Chinese< → >{t('key')}<
            replacements.push({ start: stringStart, end: i + 1, replacement: `{t('${key}')}` });
          } else {
            // Code string: "Chinese" → t('key')
            replacements.push({ start: stringStart, end: i + 1, replacement: `t('${key}')` });
          }
        } else if (CN.test(strValue)) {
          skipped++;
        }
        
        i++;
        continue;
      }
      i++;
      continue;
    }
    
    // Skip template literals
    if (ch === '`') {
      i++;
      while (i < orig.length && orig[i] !== '`') {
        if (orig[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    
    // Track brace depth
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    
    i++;
  }
  
  if (replacements.length === 0) {
    console.log(`SKIP: ${file} (${skipped} module-level strings skipped)`);
    continue;
  }
  
  // Apply replacements from end to start
  let result = orig;
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  
  // Add useTranslation import
  if (!result.includes('useTranslation')) {
    if (result.includes("from 'react'")) {
      result = result.replace(
        /(import\s+{[^}]*}\s+from\s+'react';?\n)/,
        "$1import { useTranslation } from 'react-i18next';\n"
      );
    } else {
      result = "import { useTranslation } from 'react-i18next';\n" + result;
    }
  }
  
  // Add const { t } = useTranslation() inside component functions
  // Pattern: export default function Name(...) {
  if (!result.includes('const { t } = useTranslation()')) {
    const compMatch = result.match(/(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{)/);
    if (compMatch) {
      result = result.replace(compMatch[0], compMatch[0] + '\n  const { t } = useTranslation();');
    } else {
      // Try: export function Name or function Name
      const funcMatch = result.match(/((?:export\s+)?function\s+\w+\s*\([^)]*\)\s*\{)/);
      if (funcMatch) {
        result = result.replace(funcMatch[0], funcMatch[0] + '\n  const { t } = useTranslation();');
      }
    }
  }
  
  fs.writeFileSync(fp, result, 'utf8');
  const newCn = (result.match(/[\u4e00-\u9fff]/g) || []).length;
  const removed = origCn - newCn;
  Object.assign(allT, trans);
  results.push({ file, origCn, newCn, removed, keys: Object.keys(trans).length, skipped });
}

console.log('\n=== React Safe Results ===');
let total = 0;
for (const r of results) {
  console.log(`  ${r.file}: ${r.origCn}→${r.newCn} (-${r.removed}, ${r.keys} keys, ${r.skipped} skipped)`);
  total += r.removed;
}
console.log(`\n  Total: -${total} chars, ${Object.keys(allT).length} keys`);
fs.writeFileSync(path.join(__dirname, 'i18n-react-safe-translations.json'), JSON.stringify(allT, null, 2));
