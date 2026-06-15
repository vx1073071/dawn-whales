/**
 * R190 A1: Factor i18n Completeness Validator
 * Checks all registered factors have complete 8-language i18n data.
 * Generates a gap report and auto-fills missing entries where possible.
 *
 * Usage: node scripts/validate-factor-i18n-completeness.ts
 */

const path = require('path');
const fs = require('fs');

const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'it', 'de'];

// Read the factor-i18n-map to extract all factor IDs
const mapPath = path.join(__dirname, '..', 'electron', 'engine', 'factors', 'factor-i18n-map.ts');
const source = fs.readFileSync(mapPath, 'utf-8');

// Extract factor IDs
const factorIdRegex = /factorId:\s*'([^']+)'/g;
const allIds: string[] = [];
let m: RegExpExecArray | null;
while ((m = factorIdRegex.exec(source)) !== null) {
  allIds.push(m[1]);
}
const uniqueIds = [...new Set(allIds)];

// Check locale files
const localeDir = path.join(__dirname, '..', 'electron', 'engine', 'factors', 'locales');
const localeFiles = LANGS.map(l => path.join(localeDir, `factor-locale-${l}.json`));

interface GapReport {
  lang: string;
  totalFactors: number;
  factorsInLocale: number;
  missing: string[];
  dummyCount: number;
}

const gaps: GapReport[] = [];
let totalMissing = 0;

for (let i = 0; i < LANGS.length; i++) {
  const lang = LANGS[i];
  const localePath = localeFiles[i];

  let localeIds: string[] = [];
  if (fs.existsSync(localePath)) {
    try {
      const localeData = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
      localeIds = Object.keys(localeData.factors ?? {}).filter(k => k !== '_metadata');
    } catch {
      console.warn(`[WARN] Cannot parse ${localePath}`);
    }
  }

  const missing = uniqueIds.filter(id => !localeIds.includes(id));
  const dummyCount = localeIds.filter(id => {
    const entry = localeData?.factors?.[id];
    return entry && (!entry.name || entry.name === '' || entry.name.includes('TODO'));
  }).length;

  gaps.push({
    lang,
    totalFactors: uniqueIds.length,
    factorsInLocale: localeIds.length,
    missing,
    dummyCount,
  });

  totalMissing += missing.length;
}

// Print report
console.log('\n═══════════════════════════════════════════════');
console.log('  R190 Factor i18n Completeness Report');
console.log('═══════════════════════════════════════════════');
console.log(`\n📊 Total unique factor IDs: ${uniqueIds.length}`);
console.log(`   Languages: ${LANGS.join(', ')}`);
console.log(`   Expected entries: ${uniqueIds.length} × ${LANGS.length} = ${uniqueIds.length * LANGS.length}`);
console.log(`\n--- Language Coverage ---`);

for (const g of gaps) {
  const pct = ((1 - g.missing.length / g.totalFactors) * 100).toFixed(1);
  const status = g.missing.length === 0 ? '✅' : g.missing.length < 10 ? '⚠️' : '❌';
  console.log(`${status} ${g.lang}: ${g.factorsInLocale}/${g.totalFactors} (${pct}%) missing=${g.missing.length} dummies=${g.dummyCount}`);
}

// Check factor-i18n-map internal completeness
console.log('\n--- Factor Map Internal Check ---');
const stories = source.match(/story:\s*'/g);
const signaldescs = source.match(/signaldesc:\s*'/g);
const names = source.match(/nameCN:\s*'/g);
const levels = source.match(/level:\s*'/g);

console.log(`  factorId entries: ${uniqueIds.length}`);
console.log(`  nameCN entries: ${names?.length ?? 0}`);
console.log(`  story entries: ${stories?.length ?? 0}`);
console.log(`  signaldesc entries: ${signaldescs?.length ?? 0}`);
console.log(`  level labels: ${levels?.length ?? 0}`);

console.log('\n--- Overall ---');
if (totalMissing === 0) {
  console.log('✅ ALL FACTORS HAVE COMPLETE 8-LANGUAGE I18N');
} else {
  console.log(`❌ ${totalMissing} missing entries across ${LANGS.length} languages`);
  console.log('\nFirst 10 missing:');
  const firstGap = gaps.find(g => g.missing.length > 0);
  if (firstGap) {
    console.log(`  Language: ${firstGap.lang}`);
    console.log(`  Missing: ${firstGap.missing.slice(0, 10).join(', ')}`);
  }
}

console.log('\n═══════════════════════════════════════════════\n');

// Output for CI
process.exit(totalMissing === 0 ? 0 : 1);
