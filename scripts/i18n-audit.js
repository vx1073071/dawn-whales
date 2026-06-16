/**
 * R237: i18n全量校验 — 审计所有11语言文件的键完整性
 * 以英文(EN)为基准，检查所有其他语言是否有缺失或多出的键
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const DOMAINS = ['core', 'billing', 'copytrade', 'ext', 'wallet'];
const LANGUAGES = ['zh-CN','zh-TW','zh-HK','en','ja','ko','de','fr','es','it','ru','pt'];

// Domain to filename prefix mapping
const DOMAIN_MAP = {
  core: 'en', billing: 'billing-en', copytrade: 'copytrade-en',
  ext: 'ext-en', wallet: 'wallet-en',
};

const LANG_FILES = {
  core: LANGUAGES.map(l => path.join(LOCALES_DIR, `${l}.json`)),
  billing: ['de','en','fr','it','ja','ko','zh-CN','zh-HK','zh-TW'].map(l => path.join(LOCALES_DIR, `billing-${l}.json`)),
  copytrade: ['de','en','es','fr','it','ja','ko','pt','zh-CN','zh-HK','zh-TW'].map(l => path.join(LOCALES_DIR, `copytrade-${l}.json`)),
  ext: ['de','en','fr','it','ja','ko','zh-CN','zh-HK','zh-TW'].map(l => path.join(LOCALES_DIR, `ext-${l}.json`)),
  wallet: ['de','en','es','fr','it','ja','ko','zh-CN','zh-HK','zh-TW'].map(l => path.join(LOCALES_DIR, `wallet-${l}.json`)),
};

function getKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      for (const subKey of getKeys(v, fullKey)) keys.add(subKey);
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

function countValues(obj) {
  let count = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') count++;
    else if (typeof v === 'object' && v !== null && !Array.isArray(v)) count += countValues(v);
  }
  return count;
}

let totalIssues = 0;
let totalMissing = 0;
let totalExtra = 0;

for (const [domain, files] of Object.entries(LANG_FILES)) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📦 Domain: ${domain.toUpperCase()} (${files.length} languages)`);
  console.log(`${'═'.repeat(60)}`);

  // Load all files
  const loaded = {};
  for (const f of files) {
    if (fs.existsSync(f)) {
      try {
        loaded[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(f, 'utf-8'));
      } catch (e) {
        console.log(`  ❌ PARSE ERROR: ${path.basename(f)} — ${e.message}`);
      }
    }
  }

  if (Object.keys(loaded).length === 0) {
    console.log(`  (no files loaded)`);
    continue;
  }

  // Determine baseline language (use 'en' for core, 'billing-en' for billing, etc.)
  const baselineKey = domain === 'core' ? 'en' : DOMAIN_MAP[domain];
  const baseline = loaded[baselineKey];
  if (!baseline) { console.log(`  ❌ Baseline ${baselineKey} not found`); continue; }

  const baselineKeys = getKeys(baseline);
  const baselineCount = countValues(baseline);
  console.log(`  📊 Baseline (${baselineKey}): ${baselineKeys.size} keys, ${baselineCount} values`);

  for (const [langKey, data] of Object.entries(loaded)) {
    if (langKey === baselineKey) continue;

    const langKeys = getKeys(data);
    const langCount = countValues(data);

    const missing = [...baselineKeys].filter(k => !langKeys.has(k));
    const extra = [...langKeys].filter(k => !baselineKeys.has(k));

    let status = '✅';
    if (missing.length > 0) { status = '⚠️'; totalMissing += missing.length; totalIssues += missing.length; }
    if (extra.length > 0) { totalExtra += extra.length; totalIssues += extra.length; }

    console.log(`  ${status} ${langKey.padEnd(10)}: ${langKeys.size} keys, ${langCount} values${missing.length ? ` | MISSING: ${missing.length}` : ''}${extra.length ? ` | EXTRA: ${extra.length}` : ''}`);

    if (missing.length > 0 && missing.length <= 20) {
      for (const k of missing) console.log(`       ↳ missing: ${k}`);
    } else if (missing.length > 20) {
      console.log(`       ↳ first 10 missing: ${missing.slice(0, 10).join(', ')}`);
    }
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`📊 SUMMARY:`);
console.log(`   Total missing keys: ${totalMissing}`);
console.log(`   Total extra keys: ${totalExtra}`);
console.log(`   Total issues: ${totalIssues}`);
if (totalIssues === 0) console.log(`   🎉 ALL LANGUAGES ARE 100% CONSISTENT!`);
else console.log(`   ⚠️  ${totalIssues} issues need attention`);
console.log(`${'═'.repeat(60)}`);
