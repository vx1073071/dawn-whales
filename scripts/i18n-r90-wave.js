#!/usr/bin/env node
/**
 * i18n R90: Process ALL remaining files with >30 Chinese chars
 * Uses i18n singleton pattern (works at module + component level)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const CN = /[\u4e00-\u9fff]/;
function getNs(f) { return path.basename(f).replace(/\.(ts|tsx)$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
function getRelPath(f) {
  const d = path.dirname(f);
  let r = path.relative(d, 'src/i18n').replace(/\\/g, '/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

const SKIP_PROPS = new Set(['className','style','src','href','onClick','onChange','onSubmit','onInput','onBlur','onFocus','id','key','ref','type','name','method','target','rel','role','htmlFor','as','icon','color','verdictColor','data-testid','aria-label','alt','placeholder','fill','stroke','d','viewBox','pattern']);

// Walk and find files with >30 Chinese chars
function findFiles(dirs) {
  const results = [];
  for (const dir of dirs) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    function walk(p) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (p.includes('node_modules') || p.includes('__tests__') || p.includes('.test.') || p.includes('.spec.')) return;
        fs.readdirSync(p).forEach(f => walk(path.join(p, f)));
      } else if (/\.(ts|tsx)$/.test(p) && !p.includes('.test.') && !p.includes('.spec.')) {
        const content = fs.readFileSync(p, 'utf8');
        const matches = content.match(/[\u4e00-\u9fff]/g);
        if (matches && matches.length > 30) {
          results.push({ path: path.relative(ROOT, p).replace(/\\/g, '/'), count: matches.length });
        }
      }
    }
    walk(dirPath);
  }
  return results.sort((a, b) => b.count - a.count);
}

const allFiles = findFiles(['src', 'electron']);
console.log(`Found ${allFiles.length} files with >30 Chinese chars`);

const allT = {};
const kc = {};
function nk(ns) { if (!kc[ns]) kc[ns] = 0; return `${ns}.k${++kc[ns]}`; }

const results = [];

for (const file of allFiles) {
  const fp = path.join(ROOT, file.path);
  const ns = getNs(file.path);
  const orig = fs.readFileSync(fp, 'utf8');
  const origCn = (orig.match(/[\u4e00-\u9fff]/g) || []).length;
  
  // Skip if already has i18n import from previous waves
  if (orig.includes("import i18n from '") && orig.includes('i18n.t(')) {
    // Already processed — check if there are still Chinese strings to process
    const remaining = extractStrings(orig).filter(s => CN.test(s.value));
    if (remaining.length === 0) {
      continue; // Fully done
    }
  }

  const strings = extractStrings(orig);
  const cnStrings = strings.filter(s => CN.test(s.value));
  if (cnStrings.length === 0) continue;

  const replacements = [];
  const trans = {};

  for (const s of cnStrings) {
    const key = nk(ns);
    trans[key] = s.value;

    const before = orig.slice(Math.max(0, s.start - 80), s.start);
    const attrMatch = before.match(/(\w+)=$/);

    if (attrMatch && !SKIP_PROPS.has(attrMatch[1])) {
      const prop = attrMatch[1];
      replacements.push({
        start: s.start - prop.length - 1,
        end: s.end,
        replacement: `${prop}={i18n.t('${key}')}`
      });
    } else if (attrMatch && SKIP_PROPS.has(attrMatch[1])) {
      delete trans[key]; kc[ns]--;
      continue;
    } else {
      replacements.push({
        start: s.start,
        end: s.end,
        replacement: `i18n.t('${key}')`
      });
    }
  }

  if (replacements.length === 0) {
    kc[ns] = 0; // Reset unused keys
    continue;
  }

  // Apply replacements (end to start)
  let result = orig;
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }

  // Add i18n import
  const relPath = getRelPath(file.path);
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
  results.push({ file: file.path, origCn, newCn, removed, keys: Object.keys(trans).length });
}

function extractStrings(content) {
  const strings = [];
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '/' && content[i+1] === '/') { while (i < content.length && content[i] !== '\n') i++; continue; }
    if (ch === '/' && content[i+1] === '*') { i = content.indexOf('*/', i+2); if (i === -1) break; i += 2; continue; }
    if (ch === '"' || ch === "'") {
      const q = ch;
      const start = i;
      let val = '';
      let j = i + 1;
      while (j < content.length) {
        if (content[j] === '\\') { val += content[j] + content[j+1]; j += 2; continue; }
        if (content[j] === q) break;
        val += content[j];
        j++;
      }
      if (j < content.length) {
        strings.push({ start, end: j+1, value: val, quote: q });
      }
      i = j + 1;
      continue;
    }
    if (ch === '`') {
      let j = i + 1;
      while (j < content.length && content[j] !== '`') { if (content[j] === '\\') j++; j++; }
      i = j + 1;
      continue;
    }
    i++;
  }
  return strings;
}

console.log('\n=== R90 Wave Results ===');
let total = 0;
let srcTotal = 0;
let electronTotal = 0;
for (const r of results) {
  const isElectron = r.file.startsWith('electron/');
  if (isElectron) electronTotal += r.removed; else srcTotal += r.removed;
  console.log(`  ${r.file}: ${r.origCn}→${r.newCn} (-${r.removed}, ${r.keys} keys)`);
  total += r.removed;
}
console.log(`\n  Total: -${total} chars (src: -${srcTotal}, electron: -${electronTotal})`);
console.log(`  Keys: ${Object.keys(allT).length} | Files: ${results.length}`);

fs.writeFileSync(path.join(__dirname, 'i18n-r90-translations.json'), JSON.stringify(allT, null, 2));
console.log('  Translations saved.');
