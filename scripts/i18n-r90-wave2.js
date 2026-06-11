// R90 M-02: Safe electron i18n — target -5000 chars
// Strategy: ONLY replace string literals (single/double quoted) containing CJK.
// SKIP: template literals (too risky with ${}), comments, type defs, enum values, regex.
// Use `import i18n from '<rel-path>'` + `i18n.t('key')` pattern.

const fs = require('fs');
const path = require('path');

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function countCJK(s) { return (s.match(CJK_GLOBAL) || []).length; }

function getI18nImport(filePath) {
  const dir = path.dirname(filePath);
  const i18nDir = path.join(process.cwd(), 'src/i18n');
  let rel = path.relative(dir, i18nDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function fileBase(filePath) {
  return path.basename(filePath).replace(/\.tsx?$/, '')
    .split(/[-_]/).filter(s => s.length > 0).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

// Scan ALL electron .ts files
function scan(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) scan(p, results);
    else if (/\.ts$/.test(f.name) && !f.name.includes('.test.') && !f.name.includes('.spec.')) {
      try {
        const c = fs.readFileSync(p, 'utf8');
        const chars = countCJK(c);
        if (chars > 3) results.push({ file: path.relative(process.cwd(), p).replace(/\\/g, '/'), chars });
      } catch {}
    }
  });
  return results;
}

const targets = scan('electron').sort((a, b) => b.chars - a.chars);
console.log(`Found ${targets.length} electron files with CJK\n`);

const allKeys = {};
let totalRemoved = 0;
let filesChanged = 0;

for (const { file } of targets) {
  const fullPath = path.join(process.cwd(), file);
  let content = fs.readFileSync(fullPath, 'utf8');
  const oldChars = countCJK(content);
  const base = fileBase(file);
  const keys = {};
  let idx = 0;

  // Process line by line to handle scope correctly
  const lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip: comments, imports, type/interface defs, enum lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (trimmed.startsWith('import ')) continue;
    if (trimmed.startsWith('type ') || trimmed.startsWith('interface ') || trimmed.startsWith('export type ') || trimmed.startsWith('export interface ')) continue;
    if (trimmed.match(/^\w+\s*=\s*'[^']*',?$/)) continue; // enum-like
    if (trimmed === '' || trimmed === '}' || trimmed === '{') continue;

    // Only replace single-quoted and double-quoted string LITERALS
    // Pattern: match 'text with CJK' or "text with CJK"
    // But NOT inside backticks (template literals)

    // Safety: skip if line contains backtick (template literal)
    if (line.includes('`')) continue;

    let newLine = line;

    // Replace single-quoted strings containing CJK
    newLine = newLine.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, inner) => {
      if (!CJK.test(inner)) return match;
      // Skip if it looks like a key/path/selector (no spaces, short)
      if (inner.length < 2) return match;
      const key = `${base}.k${idx++}`;
      keys[key] = inner;
      changed = true;
      return `i18n.t('${key}')`;
    });

    // Replace double-quoted strings containing CJK
    newLine = newLine.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, inner) => {
      if (!CJK.test(inner)) return match;
      if (inner.length < 2) return match;
      const key = `${base}.k${idx++}`;
      keys[key] = inner;
      changed = true;
      return `i18n.t('${key}')`;
    });

    if (newLine !== line) {
      lines[i] = newLine;
    }
  }

  if (!changed) continue;

  const newContent = lines.join('\n');
  const newChars = countCJK(newContent);
  const removed = oldChars - newChars;

  if (removed <= 0) continue;

  // Add i18n import
  if (!newContent.includes("import i18n from")) {
    const importPath = getI18nImport(file);
    const importLines = newContent.split('\n');
    let lastImport = 0;
    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].startsWith('import ')) lastImport = i;
    }
    importLines.splice(lastImport + 1, 0, `import i18n from '${importPath}';`);
    fs.writeFileSync(fullPath, importLines.join('\n'), 'utf8');
  } else {
    fs.writeFileSync(fullPath, newContent, 'utf8');
  }

  console.log(`  ${file}: -${removed} (${Object.keys(keys).length} keys)`);
  Object.assign(allKeys, keys);
  totalRemoved += removed;
  filesChanged++;
}

console.log(`\n=== M-02 Wave 2 ===`);
console.log(`Files: ${filesChanged}`);
console.log(`Chars removed: ${totalRemoved}`);
console.log(`Keys: ${Object.keys(allKeys).length}`);

fs.writeFileSync('scripts/i18n-r90-wave2-keys.json', JSON.stringify(allKeys, null, 2), 'utf8');
console.log('Keys saved.');
