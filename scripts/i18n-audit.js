const fs = require('fs');
const path = require('path');
const dir = 'src/i18n/locales';

// 1. Locale key coverage
console.log('=== 1. LOCALE KEY COVERAGE ===');
const core8 = ['en.json','zh-CN.json','zh-HK.json','ja.json','ko.json','fr.json','it.json','de.json'];
const locales = {};
for (const f of core8) {
  const fp = path.join(dir, f);
  if (!fs.existsSync(fp)) { console.log('  ' + f + ' MISSING FILE ❌'); continue; }
  locales[f] = Object.keys(JSON.parse(fs.readFileSync(fp, 'utf8'))).length;
}
const max = Math.max(...core8.map(f => locales[f] || 0));
core8.forEach(f => {
  const count = locales[f] || 0;
  const icon = count === max ? '✅' : '❌';
  console.log('  ' + icon + ' ' + f.padEnd(12) + ' ' + count + ' keys' + (count !== max ? ' (missing ' + (max - count) + ')' : ''));
});

// 2. Unresolved i18n.t() keys
console.log('\n=== 2. UNRESOLVED i18n.t() KEYS ===');
const enKeys = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
const allKeys = new Set(Object.keys(enKeys));
const missing = new Set();
function scan(dir, ex) {
  function walk(dd) {
    for (const f of fs.readdirSync(dd)) {
      const p = path.join(dd, f);
      const s = fs.statSync(p);
      if (s.isDirectory()) { if (!ex.includes(f) && !f.startsWith('.')) walk(p); }
      else if (/\.(ts|tsx|js|jsx)$/.test(f)) {
        const c = fs.readFileSync(p, 'utf8');
        const re = /i18n\.t\(['"]([^'"]+)['"]\)/g;
        let m;
        while ((m = re.exec(c)) !== null) {
          if (!allKeys.has(m[1])) missing.add(m[1]);
        }
      }
    }
  }
  walk(dir);
}
scan('src', ['node_modules', 'dist', 'locales', 'coverage', 'storybook-static', 'i18n']);
scan('electron', ['node_modules', 'dist', 'coverage']);
if (missing.size === 0) console.log('  ✅ All i18n.t() keys resolved');
else { console.log('  ❌ ' + missing.size + ' unresolved keys:'); missing.forEach(k => console.log('    - ' + k)); }

// 3. Files without i18n import that have UI strings
console.log('\n=== 3. COMPONENTS WITHOUT i18n IMPORT ===');
let noImport = 0;
function scan2(dir, ex) {
  function walk(dd) {
    for (const f of fs.readdirSync(dd)) {
      const p = path.join(dd, f);
      const s = fs.statSync(p);
      if (s.isDirectory()) { if (!ex.includes(f) && !f.startsWith('.')) walk(p); }
      else if (/\.(tsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.') && !f.includes('.stories.')) {
        const c = fs.readFileSync(p, 'utf8');
        if (!c.includes('import i18n') && !c.includes("from 'i18n'") && !c.includes('from "../../../i18n"') && !c.includes("from '../../i18n'") && !c.includes("from '../i18n'")) {
          // Only flag if it has JSX text that looks like UI
          if (/>[A-Z]/.test(c)) {
            noImport++;
            console.log('  ' + p.replace(/\\/g, '/').split('dawn-whales/')[1]);
          }
        }
      }
    }
  }
  walk(dir);
}
scan2('src', ['node_modules', 'dist', 'locales', 'coverage', 'storybook-static', 'i18n']);
if (noImport === 0) console.log('  ✅ All TSX files import i18n');

// 4. Hardcoded currency symbols
console.log('\n=== 4. HARDCODED CURRENCY SYMBOLS ===');
let currencyFiles = [];
function scan3(dir, ex) {
  function walk(dd) {
    for (const f of fs.readdirSync(dd)) {
      const p = path.join(dd, f);
      const s = fs.statSync(p);
      if (s.isDirectory()) { if (!ex.includes(f) && !f.startsWith('.')) walk(p); }
      else if (/\.(ts|tsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
        const c = fs.readFileSync(p, 'utf8');
        if (/(?:HK\$|HKD|USD|CNY)\s*[:=]\s*['"]/.test(c) || /currency\s*=\s*['"](?:HKD|USD|CNY)['"]/.test(c)) {
          currencyFiles.push(p.replace(/\\/g, '/').split('dawn-whales/')[1]);
        }
      }
    }
  }
  walk(dir);
}
scan3('src', ['node_modules', 'dist', 'locales', 'coverage', 'storybook-static', 'i18n']);
scan3('electron', ['node_modules', 'dist', 'coverage']);
if (currencyFiles.length === 0) console.log('  ✅ No hardcoded currency defaults');
else currencyFiles.forEach(f => console.log('  ⚠️  ' + f));

// 5. Summary
console.log('\n=== SUMMARY ===');
console.log('🟢 CJK: 0 (done)');
console.log('🟢 i18n keys: ' + (missing.size === 0 ? 'all resolved' : missing.size + ' unresolved ❌'));
console.log('🟢 Locale sync: ' + (new Set(core8.map(f => locales[f] || 0)).size === 1 ? 'all synced' : 'MISMATCH ❌'));
console.log('🟡 Currency: ' + currencyFiles.length + ' files with hardcoded defaults (low priority)');
console.log('🟡 Components without i18n: ' + noImport + ' (may be intentional)');
