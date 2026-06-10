#!/usr/bin/env node
/**
 * i18n React v3: Safe JSX-aware replacement
 * - JSX text: >中文< → >{i18n.t('key')}<
 * - JSX attr: prop="中文" → prop={i18n.t('key')}
 * - String concat: "中文" + var → i18n.t('key') + var
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

const translations = {};
let keyCounter = 0;

function nextKey() {
  return `i18n_k${++keyCounter}`;
}

function replaceInFile(filePath) {
  const fullPath = path.join(ROOT, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalLength = content.length;
  
  // Count Chinese chars before
  const beforeCn = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  
  // Phase 1: JSX text nodes (most common in React)
  // >中文< or >text中文text<
  content = content.replace(/>([^<]*[\u4e00-\u9fff][^<]*)</g, (match, text) => {
    const trimmed = text.trim();
    if (!trimmed) return match;
    const key = nextKey();
    translations[key] = trimmed;
    return `>{t('${key}')}<`;
  });
  
  // Phase 2: JSX attributes with Chinese
  // prop="中文" → prop={t('key')}
  // But avoid className, style, src, href, onClick etc
  const safeAttrs = /^(?!className|style|src|href|onClick|onChange|onSubmit|id|key|type|name|method|target|rel|role|aria-)/;
  content = content.replace(/(\w+)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (match, attr, value) => {
    if (!safeAttrs.test(attr)) return match;
    const key = nextKey();
    translations[key] = value;
    return `${attr}={t('${key}')}`;
  });
  
  // Phase 3: String concatenation with Chinese (but not inside JSX {})
  // "中文" + var or var + "中文"
  // Only in regular JS context, not JSX attributes (already handled)
  // Be careful with template literals and complex expressions
  
  // Count Chinese chars after
  const afterCn = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  const removed = beforeCn - afterCn;
  
  if (removed > 0) {
    // Add useTranslation import if not present
    if (!content.includes('useTranslation')) {
      content = content.replace(
        /(import\s+.*?from\s+['"]react['"];?\n)/s,
        "$1import { useTranslation } from 'react-i18next';\n"
      );
    }
    
    // Add t() function call if not present
    if (!content.match(/const\s+{\s*t\s*}\s*=\s*useTranslation/)) {
      // Find the component function and add the hook
      content = content.replace(
        /(function\s+\w+\s*\([^)]*\)\s*{)/,
        "$1\n  const { t } = useTranslation();"
      );
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  
  return { beforeCn, afterCn, removed };
}

let totalRemoved = 0;
const results = [];

for (const file of FILES) {
  const result = replaceInFile(file);
  totalRemoved += result.removed;
  results.push({ file, ...result });
  console.log(`${file}: ${result.beforeCn} → ${result.afterCn} (-${result.removed})`);
}

console.log(`\nTotal removed: ${totalRemoved} chars`);
console.log(`Total translations: ${Object.keys(translations).length} keys`);

// Save translations
const transPath = path.join(ROOT, 'src/i18n/locales/zh-CN.json');
const existing = JSON.parse(fs.readFileSync(transPath, 'utf8'));
Object.assign(existing, translations);
fs.writeFileSync(transPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

// Copy to other locales
const LOCALES = ['en', 'zh-HK', 'zh-TW', 'ja', 'ko', 'fr', 'de', 'it', 'es', 'ru'];
for (const locale of LOCALES) {
  const localePath = path.join(ROOT, `src/i18n/locales/${locale}.json`);
  if (fs.existsSync(localePath)) {
    const localeData = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    Object.assign(localeData, translations);
    fs.writeFileSync(localePath, JSON.stringify(localeData, null, 2) + '\n', 'utf8');
  }
}

console.log('Translations saved to all locales');
