/**
 * i18n R92 Turbo - Aggressive CJK extraction for remaining files
 * Handles complex JSX patterns that simpler regex miss
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const SRC = path.join(__dirname, '..', 'src');
const SKIP_DIRS = new Set(['node_modules','dist','i18n','locales','coverage','.next','.git']);
const SKIP_FILES = new Set(['i18n-data.ts','i18n-data-complete.ts','i18n-provider-zh.json']);

let locales = {};
const LOCALE_DIR = path.join(SRC, 'i18n', 'locales');
for (const f of fs.readdirSync(LOCALE_DIR)) {
  if (f.endsWith('.json')) {
    locales[f.replace('.json','')] = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, f), 'utf8'));
  }
}

function genKey(file) {
  const base = path.basename(file).replace(/\.\w+$/, '');
  return `${base}.${crypto.randomBytes(3).toString('hex')}`;
}

function ensureImport(content) {
  if (/import\s+i18n\s+from/.test(content)) return content;
  let depth = 0;
  let p = path.resolve(path.dirname('__FILE__'));
  for (let i = 0; i < 10; i++) { depth++; p = path.dirname(p); }
  const rel = '../'.repeat(Math.min(depth, 6)) + 'i18n';
  return `import i18n from '${rel}';\n` + content;
}

// Extract a CJK phrase from a larger string, replacing it with i18n
// Returns { newString, key, phrase } or null
function extractCJKSegment(line, file) {
  // Match a CJK-containing segment (CJK chars + adjacent punctuation/spaces)
  const m = line.match(/([\u4e00-\u9fff\u3400-\u4dbf][\u4e00-\u9fff\u3400-\u4dbf\w\s·→←✅❌💡🎓🎯🎚️⚠️🚀📋🤖🏆💰📊🔒🔥\u00b7\uff0c\u3001\uff1a\uff01\uff1f\u2014\u2026\u00b7\u2192\u2190\u00b7\u2022\u25cf\u25cb\u2605\u2606\u2713\u2717\u2018\u2019\u201c\u201d\u3010\u3011\uff08\uff09\u300a\u300b\uff5e\u007e\u0028\u0029\u002d\u002e\u002c\u003a\u003b\u002f\u0021\u003f\u0026\u0025\u0023\u0040\u002a\u002b\u003d\u003c\u003e\u005b\u005d\u007b\u007d\u007c\u005c\u005e\u0060\u0022\u0027\u0020]{0,80})/);
  if (!m) return null;
  let phrase = m[1].trim();
  // Remove trailing punctuation that shouldn't be in key
  phrase = phrase.replace(/[，。！？：；、\s]+$/, '');
  if (phrase.length < 2) return null;
  return phrase;
}

let totalReplacements = 0;
let newLocaleEntries = {};

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  const relPath = path.relative(SRC, filePath).replace(/\\/g, '/');
  const fileKey = path.basename(filePath).replace(/\.\w+$/, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!CJK_RE.test(line)) continue;
    
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    if (/import\s/.test(trimmed)) continue;
    if (/from\s+['"]/.test(trimmed) && trimmed.length < 100) continue;
    if (/i18n\.t\(/.test(trimmed) && !CJK_RE.test(trimmed.replace(/i18n\.t\([^)]+\)/g, ''))) continue;

    // Strategy 1: Pure JSX text node - >CJK text< or >emoji CJK text<
    const jsxTextMatch = line.match(/(>)([\s]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]*\s*[\u4e00-\u9fff].*?)(<)/u);
    if (jsxTextMatch) {
      const phrase = jsxTextMatch[2].trim();
      const key = `${fileKey}.r92_${crypto.randomBytes(2).toString('hex')}`;
      for (const lang of ['zh.json','zh-HK.json']) {
        if (!locales[lang]) locales[lang] = {};
        locales[lang][key] = phrase;
      }
      if (!locales['en.json']) locales['en.json'] = {};
      locales['en.json'][key] = phrase;
      newLocaleEntries[key] = phrase;

      const newLine = line.replace(jsxTextMatch[2], `{i18n.t('${key}')}`);
      lines[i] = newLine;
      modified = true;
      totalReplacements++;
      continue;
    }

    // Strategy 2: JSX with mixed CJK + {expressions} — extract just the CJK text parts
    // Pattern: CJK text followed by {expression}
    const mixedMatch = line.match(/(>)(.*?[\u4e00-\u9fff].*?)(\{[^}]+\})(.*?)(<)/u);
    if (mixedMatch && CJK_RE.test(mixedMatch[2])) {
      const textPart = mixedMatch[2].trim();
      const exprPart = mixedMatch[3];
      const afterPart = mixedMatch[4] || '';
      
      if (textPart.length >= 2 && CJK_RE.test(textPart)) {
        const key = `${fileKey}.r92_${crypto.randomBytes(2).toString('hex')}`;
        for (const lang of ['zh.json','zh-HK.json']) {
          if (!locales[lang]) locales[lang] = {};
          locales[lang][key] = textPart;
        }
        if (!locales['en.json']) locales['en.json'] = {};
        locales['en.json'][key] = textPart;
        newLocaleEntries[key] = textPart;

        const replacement = `{i18n.t('${key}')}${exprPart}${afterPart}`;
        lines[i] = line.replace(mixedMatch[2] + exprPart + afterPart, replacement);
        modified = true;
        totalReplacements++;
        continue;
      }
    }

    // Strategy 3: CJK in string literal '...' or "..." (not inside i18n.t)
    const strMatch = line.match(/(['"])([\u4e00-\u9fff][\u4e00-\u9fff\w\s·→←，。！？：；、\u00b7\uff0c\u3001]*?)\1/);
    if (strMatch && !line.includes('i18n.t(' + strMatch[0])) {
      const phrase = strMatch[2];
      const key = `${fileKey}.r92_${crypto.randomBytes(2).toString('hex')}`;
      for (const lang of ['zh.json','zh-HK.json']) {
        if (!locales[lang]) locales[lang] = {};
        locales[lang][key] = phrase;
      }
      if (!locales['en.json']) locales['en.json'] = {};
      locales['en.json'][key] = phrase;
      newLocaleEntries[key] = phrase;

      lines[i] = line.replace(strMatch[0], `i18n.t('${key}')`);
      modified = true;
      totalReplacements++;
      continue;
    }
  }

  if (modified) {
    let result = lines.join('\n');
    result = ensureImport(result);
    fs.writeFileSync(filePath, result);
    console.log(`  ${relPath}: ${totalReplacements} replacements`);
  }
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const s = fs.statSync(fp);
    if (s.isDirectory()) {
      if (!SKIP_DIRS.has(f)) walk(fp);
    } else if (/\.(tsx?|jsx?)$/.test(f) && !SKIP_FILES.has(f) && !f.includes('.test.') && !f.includes('.spec.')) {
      processFile(fp);
    }
  }
}

// Save locale updates
const before = {};
for (const [lang, data] of Object.entries(locales)) {
  before[lang] = Object.keys(data).length;
}

walk(SRC);

for (const [lang, data] of Object.entries(locales)) {
  const fp = path.join(LOCALE_DIR, `${lang}.json`);
  const after = Object.keys(data).length;
  if (after > (before[lang] || 0)) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  }
}

console.log(`\nTotal replacements: ${totalReplacements}`);
console.log(`New locale keys: ${Object.keys(newLocaleEntries).length}`);
