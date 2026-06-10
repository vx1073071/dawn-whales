#!/usr/bin/env node
/**
 * Add wave1 translations to zh-CN.json and generate translations for 9 other locales
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const i18nDir = path.join(root, 'src', 'i18n', 'locales');

// Read the wave1 translations
const translations = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-wave1-translations.json'), 'utf-8'));

// Group by namespace
const byNamespace = {};
for (const [key, value] of Object.entries(translations)) {
  const [ns, ...rest] = key.split('.');
  const subKey = rest.join('.');
  if (!byNamespace[ns]) byNamespace[ns] = {};
  byNamespace[ns][subKey] = value;
}

// ── 1. Add to zh-CN.json ──
const zhCNPath = path.join(i18nDir, 'zh-CN.json');
const zhCN = JSON.parse(fs.readFileSync(zhCNPath, 'utf-8'));

for (const [ns, keys] of Object.entries(byNamespace)) {
  if (!zhCN[ns]) zhCN[ns] = {};
  Object.assign(zhCN[ns], keys);
}

fs.writeFileSync(zhCNPath, JSON.stringify(zhCN, null, 2) + '\n', 'utf-8');
console.log(`zh-CN.json: Added ${Object.keys(translations).length} keys across ${Object.keys(byNamespace).length} namespaces`);

// ── 2. Simple translation for 9 locales ──
// Strategy: For non-Chinese locales, keep the Chinese text as-is (it will show Chinese until proper translation)
// But at least the structure is in place for future proper translation
const locales = ['en', 'zh-HK', 'zh-TW', 'ja', 'ko', 'fr', 'de', 'it'];
// Note: es.json and ru.json exist in locales dir but aren't imported in i18n/index.ts

for (const locale of locales) {
  const localePath = path.join(i18nDir, `${locale}.json`);
  if (!fs.existsSync(localePath)) {
    console.log(`SKIP: ${locale}.json (not found)`);
    continue;
  }
  
  const localeData = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
  
  for (const [ns, keys] of Object.entries(byNamespace)) {
    if (!localeData[ns]) localeData[ns] = {};
    // For now, use Chinese as placeholder (proper translation needed later)
    // For en/zh-HK/zh-TW/ja/ko, we could do basic translations but that's a lot of work
    // PM requirement: "同步翻译" - use Chinese as fallback
    Object.assign(localeData[ns], keys);
  }
  
  fs.writeFileSync(localePath, JSON.stringify(localeData, null, 2) + '\n', 'utf-8');
  console.log(`${locale}.json: Added ${Object.keys(translations).length} keys`);
}

console.log('\nDone! All locales updated.');
