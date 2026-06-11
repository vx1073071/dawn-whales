// R90 M-02: Batch i18n for electron/ files
// Uses `import i18n from 'relative/path/i18n'` + `i18n.t('key')` pattern
// Handles: string literals, template literals with Chinese, object values, array items

const fs = require('fs');
const path = require('path');

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

// Find all electron .ts files with hardcoded Chinese
function scanDir(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) scanDir(p, results);
    else if (/\.ts$/.test(f.name) && !f.name.includes('.test.') && !f.name.includes('.spec.')) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const matches = content.match(CJK_GLOBAL);
        if (matches && matches.length > 5) { // Only process files with 5+ CJK chars
          results.push({
            file: path.relative(process.cwd(), p).replace(/\\/g, '/'),
            chars: matches.length,
            content
          });
        }
      } catch {}
    }
  });
  return results;
}

function getI18nImportPath(filePath) {
  // Calculate relative path from file to src/i18n/index.ts
  const fileDir = path.dirname(filePath);
  const i18nDir = path.join(process.cwd(), 'src/i18n');
  let rel = path.relative(fileDir, i18nDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function makeKey(fileBase, idx) {
  return `${fileBase}.k${idx}`;
}

function getFileBase(filePath) {
  const name = path.basename(filePath, '.ts').replace(/\.tsx$/, '');
  // Convert to PascalCase-ish key
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// Process a single file
function processFile(entry) {
  const { file, content } = entry;
  const lines = content.split('\n');
  const fileBase = getFileBase(file);
  const keys = {};
  let keyIdx = 0;
  let changed = false;

  // Check if i18n is already imported
  const hasI18nImport = lines.some(l => l.includes("from '") && l.includes('i18n') && !l.includes('i18next'));

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip import lines and comments
    if (line.trim().startsWith('import ') || line.trim().startsWith('//')) continue;
    
    // Skip lines without CJK
    if (!CJK.test(line)) continue;
    
    // Skip type definitions
    if (line.trim().startsWith('type ') || line.trim().startsWith('interface ')) continue;
    
    // Strategy: Replace Chinese string literals with i18n.t() calls
    // Match patterns like: '中文' or "中文" or `中文`
    let newLine = line;
    
    // Replace single-quoted strings with Chinese
    newLine = newLine.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (match, str) => {
      const key = makeKey(fileBase, keyIdx++);
      keys[key] = str;
      changed = true;
      return `i18n.t('${key}')`;
    });
    
    // Replace double-quoted strings with Chinese (but not already replaced)
    newLine = newLine.replace(/"([^"]*[\u4e00-\u9fff][^"]*)"/g, (match, str) => {
      if (str.includes('i18n.t(')) return match; // Already replaced
      const key = makeKey(fileBase, keyIdx++);
      keys[key] = str;
      changed = true;
      return `i18n.t('${key}')`;
    });
    
    // Replace template literals with Chinese (simple cases without interpolation)
    newLine = newLine.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (match, str) => {
      if (str.includes('${') || str.includes('i18n.t(')) return match; // Skip complex templates
      const key = makeKey(fileBase, keyIdx++);
      keys[key] = str;
      changed = true;
      return `i18n.t('${key}')`;
    });
    
    if (newLine !== line) {
      lines[i] = newLine;
    }
  }

  if (!changed) return { keys: {}, charsRemoved: 0 };

  // Add i18n import if not present
  if (!hasI18nImport) {
    const importPath = getI18nImportPath(file);
    // Find last import line
    let lastImportIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImportIdx = i;
    }
    lines.splice(lastImportIdx + 1, 0, `import i18n from '${importPath}';`);
  }

  const newContent = lines.join('\n');
  
  // Count remaining CJK chars
  const oldChars = (content.match(CJK_GLOBAL) || []).length;
  const newChars = (newContent.match(CJK_GLOBAL) || []).length;
  
  fs.writeFileSync(path.join(process.cwd(), file), newContent, 'utf8');
  
  return { keys, charsRemoved: oldChars - newChars };
}

// Main
const files = scanDir('electron');
files.sort((a, b) => b.chars - a.chars);

console.log(`Found ${files.length} electron files with hardcoded Chinese\n`);

const allKeys = {};
let totalRemoved = 0;
let filesProcessed = 0;

for (const entry of files) {
  const result = processFile(entry);
  const removed = result.charsRemoved;
  if (removed > 0) {
    console.log(`  ${entry.file}: ${entry.chars} → ${entry.chars - removed} (-${removed}, ${Object.keys(result.keys).length} keys)`);
    Object.assign(allKeys, result.keys);
    totalRemoved += removed;
    filesProcessed++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Files processed: ${filesProcessed}`);
console.log(`Chars removed: ${totalRemoved}`);
console.log(`Keys generated: ${Object.keys(allKeys).length}`);

// Write keys to JSON for translation
fs.writeFileSync(
  path.join(process.cwd(), 'scripts/i18n-r90-electron-keys.json'),
  JSON.stringify(allKeys, null, 2),
  'utf8'
);
console.log(`Keys saved to scripts/i18n-r90-electron-keys.json`);
