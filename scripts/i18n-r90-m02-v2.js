// R90 M-02 v2: Process multi-line template literals in electron files
// Strategy: For each template literal containing CJK:
//   - Replace Chinese text segments (between ${} exprs) with ${i18n.t('key')}
//   - Keep ${...} expressions unchanged

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
    .split(/[-_]/).filter(Boolean).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return { removed: 0, keyCount: 0 };
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const oldChars = countCJK(content);
  const base = fileBase(filePath);
  const keys = {};
  let idx = 0;
  
  // Find all template literals (backtick strings)
  let result = '';
  let pos = 0;
  
  while (pos < content.length) {
    // Skip string literals
    if (content[pos] === "'" || content[pos] === '"') {
      const quote = content[pos];
      let end = pos + 1;
      while (end < content.length && content[end] !== quote) {
        if (content[end] === '\\') end++;
        end++;
      }
      result += content.substring(pos, end + 1);
      pos = end + 1;
      continue;
    }
    
    // Skip single-line comments
    if (content[pos] === '/' && content[pos + 1] === '/') {
      let end = content.indexOf('\n', pos);
      if (end === -1) end = content.length;
      result += content.substring(pos, end);
      pos = end;
      continue;
    }
    
    // Skip block comments
    if (content[pos] === '/' && content[pos + 1] === '*') {
      let end = content.indexOf('*/', pos + 2);
      if (end === -1) end = content.length; else end += 2;
      result += content.substring(pos, end);
      pos = end;
      continue;
    }
    
    // Template literal
    if (content[pos] === '`') {
      const tlStart = pos;
      let tlEnd = pos + 1;
      let depth = 0;
      
      // Find the closing backtick, handling nested ${} with template literals
      while (tlEnd < content.length) {
        if (content[tlEnd] === '\\') { tlEnd += 2; continue; }
        if (content[tlEnd] === '$' && content[tlEnd + 1] === '{') {
          depth++;
          tlEnd += 2;
          continue;
        }
        if (content[tlEnd] === '}' && depth > 0) {
          depth--;
          tlEnd++;
          continue;
        }
        if (content[tlEnd] === '`' && depth === 0) break;
        tlEnd++;
      }
      
      if (tlEnd >= content.length) {
        result += content[pos];
        pos++;
        continue;
      }
      
      const tlContent = content.substring(tlStart + 1, tlEnd);
      
      if (CJK.test(tlContent)) {
        // Process this template literal
        const processed = processTemplateLiteral(tlContent, base, keys, () => idx++);
        result += '`' + processed + '`';
      } else {
        result += content.substring(tlStart, tlEnd + 1);
      }
      
      pos = tlEnd + 1;
      continue;
    }
    
    result += content[pos];
    pos++;
  }
  
  const newChars = countCJK(result);
  const removed = oldChars - newChars;
  
  if (removed <= 0) return { removed: 0, keyCount: 0 };
  
  // Add i18n import
  if (!result.includes("import i18n from")) {
    const importPath = getI18nImport(filePath);
    const lines = result.split('\n');
    let lastImport = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, `import i18n from '${importPath}';`);
    result = lines.join('\n');
  }
  
  fs.writeFileSync(fullPath, result, 'utf8');
  return { removed, keyCount: Object.keys(keys).length, keys };
}

function processTemplateLiteral(content, base, keys, nextIdx) {
  // Split into text segments and ${} expressions
  const parts = [];
  let pos = 0;
  let textStart = 0;
  
  while (pos < content.length) {
    if (content[pos] === '$' && content[pos + 1] === '{') {
      // Text before this expression
      if (pos > textStart) {
        parts.push({ type: 'text', value: content.substring(textStart, pos) });
      }
      // Find matching closing brace
      let depth = 1;
      let exprEnd = pos + 2;
      while (exprEnd < content.length && depth > 0) {
        if (content[exprEnd] === '{') depth++;
        if (content[exprEnd] === '}') depth--;
        if (depth > 0) exprEnd++;
      }
      parts.push({ type: 'expr', value: content.substring(pos, exprEnd + 1) });
      textStart = exprEnd + 1;
      pos = exprEnd + 1;
    } else {
      pos++;
    }
  }
  
  // Remaining text
  if (textStart < content.length) {
    parts.push({ type: 'text', value: content.substring(textStart) });
  }
  
  // Process text parts: replace CJK segments with ${i18n.t('key')}
  const processed = parts.map(part => {
    if (part.type === 'expr') return part.value;
    
    // Text part - find CJK segments
    if (!CJK.test(part.value)) return part.value;
    
    // Replace CJK text runs (including surrounding punctuation/spaces)
    // Match: sequences that include CJK chars + surrounding non-${} text
    return part.value.replace(/([^\n]*?[\u4e00-\u9fff\u3400-\u4dbf][^\n]*?)(?=\n|$)/g, (match) => {
      // Only replace if it has CJK
      if (!CJK.test(match)) return match;
      const trimmed = match.trim();
      if (!trimmed) return match;
      
      // Keep leading/trailing whitespace
      const leading = match.match(/^\s*/)[0];
      const trailing = match.match(/\s*$/)[0];
      const core = match.trim();
      
      if (!CJK.test(core)) return match;
      
      const key = `${base}.k${nextIdx()}`;
      keys[key] = core;
      return leading + '${i18n.t(\'' + key + '\')}' + trailing;
    });
  });
  
  return processed.join('');
}

// Scan ALL electron .ts files
function scanAll(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules', 'dist', '.git'].includes(f.name)) return;
    if (f.isDirectory()) scanAll(p, results);
    else if (/\.ts$/.test(f.name) && !f.name.includes('.test.') && !f.name.includes('.spec.')) {
      try {
        const c = fs.readFileSync(p, 'utf8');
        if (countCJK(c) > 3) {
          results.push(path.relative(process.cwd(), p).replace(/\\/g, '/'));
        }
      } catch {}
    }
  });
  return results;
}

// Main - process ALL electron files
const targets = scanAll('electron');
console.log(`Processing ${targets.length} electron files...\n`);

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

console.log(`\n=== M-02 Final ===`);
console.log(`Files: ${filesChanged}`);
console.log(`Chars removed: ${totalRemoved}`);
console.log(`Keys: ${Object.keys(allKeys).length}`);

fs.writeFileSync('scripts/i18n-r90-m02-keys.json', JSON.stringify(allKeys, null, 2), 'utf8');
console.log('Keys saved.');
