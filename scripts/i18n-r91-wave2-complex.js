// R91 Wave 2: Handle complex JSX patterns (text + {expr} mixed)
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
    
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (trimmed.startsWith('import ')) continue;
    if (trimmed.startsWith('type ') || trimmed.startsWith('interface ')) continue;
    
    if (!CJK.test(line)) continue;
    
    let newLine = line;
    
    // Pattern: JSX text with mixed {expr} and CJK
    // e.g., "💡 举例：{story.example}" → "{i18n.t('key')}{story.example}"
    // e.g., "{story.initial} → {story.final} · 最大回撤" → "{story.initial}{i18n.t('arrow')}{story.final} · {i18n.t('maxDrawdown')}"
    
    // Find JSX text segments (between > and <) that contain both CJK and {expr}
    newLine = newLine.replace(
      />([^<]*[\u4e00-\u9fff][^<]*\{[^}]+\}[^<]*)</g,
      (match, inner) => {
        if (!CJK.test(inner)) return match;
        
        // Split by {expr} patterns and process CJK segments
        const parts = inner.split(/(\{[^}]+\})/);
        const processed = parts.map(part => {
          if (part.startsWith('{') && part.endsWith('}')) return part; // Keep expr
          if (!CJK.test(part)) return part;
          const core = part.trim();
          if (!core || core.length < 2) return part;
          const key = `${base}.k${idx++}`;
          keys[key] = core;
          changed = true;
          return `{i18n.t('${key}')}`;
        });
        
        return '>' + processed.join('') + '<';
      }
    );
    
    // Pattern: Template literals with ${} interpolation and CJK
    // e.g., `${diffMin}分钟前` → `${diffMin}${i18n.t('minutesAgo')}`
    newLine = newLine.replace(
      /`([^`]*[\u4e00-\u9fff][^`]*)`/g,
      (match, inner) => {
        if (!CJK.test(inner)) return match;
        if (inner.includes('i18n.t(')) return match;
        
        if (inner.includes('${')) {
          // Complex template: replace CJK segments around ${}
          const parts = inner.split(/(\$\{[^}]+\})/);
          const processed = parts.map(part => {
            if (part.startsWith('${') && part.endsWith('}')) return part;
            if (!CJK.test(part)) return part;
            const key = `${base}.k${idx++}`;
            keys[key] = part;
            changed = true;
            return `\${i18n.t('${key}')}`;
          });
          return '`' + processed.join('') + '`';
        }
        
        // Simple template
        const key = `${base}.k${idx++}`;
        keys[key] = inner;
        changed = true;
        return `i18n.t('${key}')`;
      }
    );
    
    // Pattern: JSX attribute strings with CJK (not already processed)
    // e.g., title="在线虾" → title={i18n.t('key')}
    newLine = newLine.replace(
      /(\w+)="([^"]*[\u4e00-\u9fff][^"]*)"/g,
      (match, attr, inner) => {
        if (['className', 'style', 'src', 'href', 'type', 'name', 'id', 'key', 'ref'].includes(attr)) return match;
        if (inner.includes('i18n.t(')) return match;
        const key = `${base}.k${idx++}`;
        keys[key] = inner;
        changed = true;
        return `${attr}={i18n.t('${key}')}`;
      }
    );
    
    // Pattern: Single-quoted strings in code (not JSX attrs)
    newLine = newLine.replace(
      /(?<![=\w])'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g,
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

// Scan ALL src files
function scanAll(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules','dist','.git','i18n','scripts'].includes(f.name)) return;
    if (f.isDirectory()) scanAll(p, results);
    else if (/\.(tsx?|jsx?)$/.test(f.name)) {
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

console.log(`\n=== R91 Wave 2 ===`);
console.log(`Files: ${filesChanged}, Removed: -${totalRemoved}, Keys: ${Object.keys(allKeys).length}`);

fs.writeFileSync('scripts/i18n-r91-wave2-keys.json', JSON.stringify(allKeys, null, 2), 'utf8');
console.log('Keys saved.');
