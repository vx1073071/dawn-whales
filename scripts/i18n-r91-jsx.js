// R91 M-01: JSX-aware i18n processor
// Handles: JSX text nodes, template literals in JSX, string literals in JSX expressions
// Pattern: Replace Chinese text in JSX with {i18n.t('key')} calls

const fs = require('fs');
const path = require('path');

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
const CJK_RANGE = '\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef';

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
    .split(/[-_]/).filter(Boolean).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  const oldChars = countCJK(content);
  const base = fileBase(filePath);
  const keys = {};
  let idx = 0;
  let changed = false;

  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip comments and imports
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (trimmed.startsWith('import ')) continue;
    
    if (!CJK.test(line)) continue;
    
    let newLine = line;
    
    // Pattern 1: JSX text nodes — text between > and < that contains CJK
    // e.g., <span>创作者中心</span> → <span>{i18n.t('key')}</span>
    // Also: <h2 className="...">智能选股</h2>
    newLine = newLine.replace(
      new RegExp(`(>)(\\s*)([^{<>*]*[${CJK_RANGE}][^{<>*]*?)(\\s*)(</)`, 'g'),
      (match, open, spaceBefore, text, spaceAfter, close) => {
        const core = text.trim();
        if (!core || !CJK.test(core)) return match;
        // Skip if it contains JSX expressions already
        if (core.includes('{') && core.includes('}')) {
          // Mixed: text + {expr} + text — handle separately
          return match;
        }
        const key = `${base}.k${idx++}`;
        keys[key] = core;
        changed = true;
        return `${open}{i18n.t('${key}')}${close}`;
      }
    );
    
    // Pattern 2: JSX text with mixed content (text + {expr})
    // e.g., 💡 举例：{story.example} → {i18n.t('key')}{story.example}
    newLine = newLine.replace(
      new RegExp(`(>)(\\s*)([${CJK_RANGE}][^<]*?)(\\{[^}]+\\})([^<]*?)(</)`, 'g'),
      (match, open, sp1, textBefore, expr, textAfter, close) => {
        const coreBefore = textBefore.trim();
        const coreAfter = textAfter.trim();
        if (!CJK.test(coreBefore) && !CJK.test(coreAfter)) return match;
        
        let replacement = open;
        if (CJK.test(coreBefore)) {
          const key = `${base}.k${idx++}`;
          keys[key] = coreBefore;
          changed = true;
          replacement += `{i18n.t('${key}')}`;
        }
        replacement += expr;
        if (CJK.test(coreAfter)) {
          const key = `${base}.k${idx++}`;
          keys[key] = coreAfter;
          changed = true;
          replacement += `{i18n.t('${key}')}`;
        }
        replacement += close;
        return replacement;
      }
    );
    
    // Pattern 3: Template literals with CJK in JSX expressions
    // e.g., `${diffMin}分钟前` → `${diffMin}${i18n.t('key')}`
    newLine = newLine.replace(
      /`([^`]*?[\u4e00-\u9fff][^`]*?)`/g,
      (match, inner) => {
        if (!CJK.test(inner)) return match;
        if (inner.includes('${')) {
          // Complex template: replace CJK segments around ${} 
          let processed = inner;
          // Replace CJK text after ${expr}
          processed = processed.replace(
            new RegExp(`(\\$\\{[^}]+\\})([${CJK_RANGE}]+)`, 'g'),
            (m, expr, chinese) => {
              const key = `${base}.k${idx++}`;
              keys[key] = chinese;
              changed = true;
              return `${expr}\${i18n.t('${key}')}`;
            }
          );
          // Replace CJK text before ${expr}
          processed = processed.replace(
            new RegExp(`([${CJK_RANGE}][${CJK_RANGE}\\s·:：,，.。!！?？、;；""''（）\\-—…·]*?)(\\$\\{)`, 'g'),
            (m, chinese, exprStart) => {
              const key = `${base}.k${idx++}`;
              keys[key] = chinese.trim();
              changed = true;
              return `\${i18n.t('${key}')}${exprStart}`;
            }
          );
          // Replace remaining pure CJK segments (no ${})
          if (CJK.test(processed) && !processed.includes('${')) {
            const key = `${base}.k${idx++}`;
            keys[key] = processed;
            changed = true;
            return `i18n.t('${key}')`;
          }
          return '`' + processed + '`';
        }
        // Simple template without interpolation
        const key = `${base}.k${idx++}`;
        keys[key] = inner;
        changed = true;
        return `i18n.t('${key}')`;
      }
    );
    
    // Pattern 4: Single-quoted strings with CJK (not already i18n.t'd)
    newLine = newLine.replace(
      /'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g,
      (match, inner) => {
        if (inner.includes('i18n.t(') || inner.length < 2) return match;
        const key = `${base}.k${idx++}`;
        keys[key] = inner;
        changed = true;
        return `i18n.t('${key}')`;
      }
    );
    
    // Pattern 5: Double-quoted strings with CJK
    newLine = newLine.replace(
      /"([^"\n]*[\u4e00-\u9fff][^"\n]*)"/g,
      (match, inner) => {
        if (inner.includes('i18n.t(') || inner.length < 2) return match;
        const key = `${base}.k${idx++}`;
        keys[key] = inner;
        changed = true;
        return `i18n.t('${key}')`;
      }
    );
    
    if (newLine !== line) {
      lines[i] = newLine;
    }
  }
  
  if (!changed) return { removed: 0, keyCount: 0 };
  
  content = lines.join('\n');
  const newChars = countCJK(content);
  const removed = oldChars - newChars;
  
  if (removed <= 0) return { removed: 0, keyCount: 0 };
  
  // Add i18n import if needed
  if (!content.includes("import i18n from")) {
    const importPath = getI18nImport(filePath);
    const importLines = content.split('\n');
    let lastImport = 0;
    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].startsWith('import ')) lastImport = i;
    }
    importLines.splice(lastImport + 1, 0, `import i18n from '${importPath}';`);
    content = importLines.join('\n');
  }
  
  fs.writeFileSync(fullPath, content, 'utf8');
  return { removed, keyCount: Object.keys(keys).length, keys };
}

// Scan ALL .tsx files in src/
function scanAll(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules','dist','.git','i18n','scripts'].includes(f.name)) return;
    if (f.isDirectory()) scanAll(p, results);
    else if (/\.(tsx|ts)$/.test(f.name)) {
      try {
        const c = fs.readFileSync(p, 'utf8');
        if (countCJK(c) > 5) {
          results.push(path.relative(process.cwd(), p).replace(/\\/g, '/'));
        }
      } catch {}
    }
  });
  return results;
}

// Process all src files
const targets = scanAll('src');
console.log(`Processing ${targets.length} src files...\n`);

const allKeys = {};
let totalRemoved = 0;
let filesChanged = 0;

for (const file of targets) {
  const result = processFile(file);
  if (result.removed > 0) {
    console.log(`  ${file}: -${result.removed} (${result.keyCount} keys)`);
    Object.assign(allKeys, result.keys || {});
    totalRemoved += result.removed;
    filesChanged++;
  }
}

console.log(`\n=== R91 JSX i18n ===`);
console.log(`Files: ${filesChanged}`);
console.log(`Chars removed: ${totalRemoved}`);
console.log(`Keys: ${Object.keys(allKeys).length}`);

fs.writeFileSync('scripts/i18n-r91-jsx-keys.json', JSON.stringify(allKeys, null, 2), 'utf8');
console.log('Keys saved.');
