#!/usr/bin/env node
/**
 * i18n Wave 3: Process ALL remaining electron files with >100 Chinese chars
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// Walk electron dir to find all .ts files with Chinese
const cnRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
const filesToProcess = [];

function walk(dir) {
  const stat = fs.statSync(dir);
  if (stat.isDirectory()) {
    if (dir.includes('node_modules') || dir.includes('.test.') || dir.includes('__tests__')) return;
    fs.readdirSync(dir).forEach(f => walk(path.join(dir, f)));
  } else if (dir.endsWith('.ts') && !dir.includes('.test.') && !dir.includes('.spec.')) {
    const content = fs.readFileSync(dir, 'utf-8');
    const matches = content.match(cnRegex);
    if (matches && matches.length > 50) { // Only files with >50 Chinese chars
      filesToProcess.push({ path: path.relative(root, dir).replace(/\\/g, '/'), count: matches.length });
    }
  }
}

walk(path.join(root, 'electron'));
filesToProcess.sort((a, b) => b.count - a.count);

console.log(`Found ${filesToProcess.length} electron files with >50 Chinese chars`);
console.log('Files:', filesToProcess.map(f => `${f.path} (${f.count})`).join('\n'));

// Process them
const keyCounters = {};
function nextKey(ns) {
  if (!keyCounters[ns]) keyCounters[ns] = 0;
  keyCounters[ns]++;
  return `${ns}.k${keyCounters[ns]}`;
}

function getImportPath(fp) {
  let rel = path.relative(path.dirname(fp), 'src/i18n').replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function getNs(fp) {
  return path.basename(fp).replace(/\.(ts|tsx)$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const allT = {};
const results = [];

for (const file of filesToProcess) {
  const fp = path.join(root, file.path);
  const ns = getNs(file.path);
  const orig = fs.readFileSync(fp, 'utf-8');
  const lines = orig.split('\n');
  let inBlock = false;
  let changed = false;
  const trans = {};

  // Skip if already has i18n import from wave1/2
  const alreadyProcessed = orig.includes("import i18n from '") && orig.includes("i18n.t('");

  const newLines = lines.map(line => {
    if (inBlock) { if (line.includes('*/')) inBlock = false; return line; }
    if (line.trim().startsWith('//')) return line;
    if (line.trim().startsWith('/*')) { inBlock = !line.includes('*/'); return line; }

    let nl = line;
    nl = nl.replace(/"([^"]*[\u4e00-\u9fff][^"]*)"/g, (m, s) => {
      // Skip if already an i18n.t() call
      if (m.includes("i18n.t('")) return m;
      const k = nextKey(ns); trans[k] = s; changed = true;
      return `i18n.t('${k}')`;
    });
    nl = nl.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (m, s) => {
      if (m.includes("i18n.t('")) return m;
      const k = nextKey(ns); trans[k] = s; changed = true;
      return `i18n.t('${k}')`;
    });
    nl = nl.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (m, s) => {
      if (m.includes("i18n.t('")) return m;
      const k = nextKey(ns); trans[k] = s; changed = true;
      return `i18n.t('${k}')`;
    });
    return nl;
  });

  if (!changed) continue;

  let content = newLines.join('\n');
  // Add i18n import if not already there
  const imp = `import i18n from '${getImportPath(file.path)}';`;
  if (!content.includes("import i18n from '")) {
    const ls = content.split('\n');
    let last = -1;
    for (let i = 0; i < ls.length; i++) if (ls[i].startsWith('import ')) last = i;
    ls.splice(Math.max(last + 1, 0), 0, imp);
    content = ls.join('\n');
  }

  fs.writeFileSync(fp, content, 'utf-8');
  const origCn = (orig.match(cnRegex) || []).length;
  const newCn = (content.match(cnRegex) || []).length;
  Object.assign(allT, trans);
  results.push({ file: file.path, origCn, newCn, removed: origCn - newCn, keys: Object.keys(trans).length });
}

console.log('\n=== Wave 3 Results ===');
let total = 0;
results.forEach(r => {
  console.log(`  ${r.file}: ${r.origCn} → ${r.newCn} (-${r.removed}, ${r.keys} keys)`);
  total += r.removed;
});
console.log(`\n  Total removed: ${total} chars | Keys: ${Object.keys(allT).length} | Files: ${results.length}`);

fs.writeFileSync(path.join(__dirname, 'i18n-wave3-translations.json'), JSON.stringify(allT, null, 2), 'utf-8');
console.log('  Translations saved.');
