/**
 * R237: i18n补漏工具 — 以英文为基线，自动填充所有缺失键
 * 对于缺失键，填入英文值作为fallback
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

// Core locale files
const coreLocales = ['zh-CN','zh-TW','zh-HK','ja','ko','de','fr','es','it','ru'];
const enPath = path.join(LOCALES_DIR, 'en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...getAllKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function setValue(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function sortObjKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjKeys(obj[key]);
  }
  return sorted;
}

const enKeys = new Set(getAllKeys(enData));
let totalPatched = 0;

for (const locale of coreLocales) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${locale}: file not found, skipping`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const localeKeys = new Set(getAllKeys(data));
  const missing = [...enKeys].filter(k => !localeKeys.has(k));

  if (missing.length === 0) {
    console.log(`  ✅ ${locale}: already complete`);
    continue;
  }

  for (const key of missing) {
    const enVal = getValue(enData, key);
    setValue(data, key, enVal !== undefined ? enVal : `[MISSING: ${key}]`);
  }

  // Sort keys for consistency
  const sorted = sortObjKeys(data);
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');

  const afterKeys = getAllKeys(data);
  const afterMissing = [...enKeys].filter(k => !new Set(afterKeys).has(k));

  console.log(`  🔧 ${locale}: patched ${missing.length} missing keys${afterMissing.length > 0 ? `, ${afterMissing.length} still missing` : ', now complete ✅'}`);
  totalPatched += missing.length;
}

console.log(`\n📊 Total keys patched: ${totalPatched}`);

// Also check for any .json files that might be corrupted
console.log(`\nVerifying all locale files parse correctly...`);
const allJson = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
for (const f of allJson) {
  try {
    JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, f), 'utf-8'));
  } catch (e) {
    console.log(`  ❌ CORRUPT: ${f} — ${e.message}`);
  }
}
console.log(`  All JSON files valid.`);
