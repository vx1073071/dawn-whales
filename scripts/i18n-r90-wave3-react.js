// R90 Wave 3: Batch process ALL React components with hardcoded Chinese
// Uses import i18n + i18n.t() pattern (works at module level AND inside components)
const fs = require('fs');
const path = require('path');

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function scanDir(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules','dist','.git','i18n','scripts'].includes(f.name)) return;
    if (f.isDirectory()) scanDir(p, results);
    else if (/\.tsx$/.test(f.name)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const lines = content.split('\n');
        let codeChars = 0;
        lines.forEach(l => {
          const m = l.match(CJK_GLOBAL);
          if (!m) return;
          const t = l.trim();
          if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) codeChars += m.length;
        });
        if (codeChars > 5) {
          results.push({ file: path.relative(process.cwd(), p).replace(/\\/g, '/'), codeChars, content });
        }
      } catch {}
    }
  });
  return results;
}

function getI18nImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const i18nDir = path.join(process.cwd(), 'src/i18n');
  let rel = path.relative(fileDir, i18nDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function getFileBase(filePath) {
  return path.basename(filePath).replace(/\.tsx$/, '')
    .split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

const files = scanDir('src');
files.sort((a, b) => b.codeChars - a.codeChars);

console.log(`Processing ${files.length} React files...\n`);

const allKeys = {};
let totalRemoved = 0;
let filesProcessed = 0;

for (const entry of files) {
  const { file, content: origContent } = entry;
  const fullPath = path.join(process.cwd(), file);
  const fileBase = getFileBase(file);
  const keys = {};
  let keyIdx = 0;
  
  let content = origContent;
  const hasI18n = content.includes("import i18n from");
  
  // 1. Replace single-quoted strings with CJK
  content = content.replace(/'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g, (match, str) => {
    const key = `${fileBase}.k${keyIdx++}`;
    keys[key] = str;
    return `i18n.t('${key}')`;
  });
  
  // 2. Replace double-quoted strings with CJK
  content = content.replace(/"([^"\n]*[\u4e00-\u9fff][^"\n]*)"/g, (match, str) => {
    const key = `${fileBase}.k${keyIdx++}`;
    keys[key] = str;
    return `i18n.t('${key}')`;
  });
  
  // 3. Replace template literals without interpolation
  content = content.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (match, inner) => {
    if (!CJK.test(inner)) return match;
    if (inner.includes('${')) return match; // Skip complex templates
    const key = `${fileBase}.k${keyIdx++}`;
    keys[key] = inner;
    return `i18n.t('${key}')`;
  });
  
  const oldChars = (origContent.match(CJK_GLOBAL) || []).length;
  const newChars = (content.match(CJK_GLOBAL) || []).length;
  const removed = oldChars - newChars;
  
  if (removed > 0 && Object.keys(keys).length > 0) {
    // Add i18n import if not present
    if (!hasI18n) {
      const importPath = getI18nImportPath(file);
      const lines = content.split('\n');
      let lastImportIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) lastImportIdx = i;
      }
      lines.splice(lastImportIdx + 1, 0, `import i18n from '${importPath}';`);
      content = lines.join('\n');
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    if (removed > 10) { // Only log significant changes
      console.log(`  ${file}: -${removed} (${Object.keys(keys).length} keys)`);
    }
    Object.assign(allKeys, keys);
    totalRemoved += removed;
    filesProcessed++;
  }
}

console.log(`\n=== Wave 3 React Summary ===`);
console.log(`Files processed: ${filesProcessed}`);
console.log(`Chars removed: ${totalRemoved}`);
console.log(`Keys generated: ${Object.keys(allKeys).length}`);

// Save keys
fs.writeFileSync('scripts/i18n-r90-wave3-keys.json', JSON.stringify(allKeys, null, 2), 'utf8');
console.log('Keys saved.');
