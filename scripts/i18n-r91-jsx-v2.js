// R91 M-01 v2: Safe JSX-aware i18n processor
// Key fix: JSX attributes need {i18n.t()} not bare i18n.t()

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
    
    // Skip comments, imports, type defs
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (trimmed.startsWith('import ')) continue;
    if (trimmed.startsWith('type ') || trimmed.startsWith('interface ')) continue;
    if (trimmed.startsWith('export type') || trimmed.startsWith('export interface')) continue;
    
    if (!CJK.test(line)) continue;
    
    let newLine = line;
    
    // Pattern A: JSX attribute with double-quoted CJK string
    // e.g., placeholder="输入选股条件" → placeholder={i18n.t('key')}
    newLine = newLine.replace(
      /(\w+)="([^"]*[\u4e00-\u9fff][^"]*)"/g,
      (match, attr, inner) => {
        if (inner.includes('i18n.t(')) return match;
        if (inner.length < 2) return match;
        // Skip className, style, and other non-text attributes
        if (['className', 'style', 'src', 'href', 'type', 'name', 'id', 'key', 'ref'].includes(attr)) return match;
        const key = `${base}.k${idx++}`;
        keys[key] = inner;
        changed = true;
        return `${attr}={i18n.t('${key}')}`;
      }
    );
    
    // Pattern B: JSX text nodes - text between > and < that is pure CJK text
    // e.g., >创作者中心< → >{i18n.t('key')}<
    // But NOT for closing tags or self-closing
    newLine = newLine.replace(
      />(\s*)([\u4e00-\u9fff\u3400-\u4dbf][\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\w\s·×✓✗❌✅⚠️💡🏆⭐📝📥📤📋📡🚀👋👀🔍🏦💰💳🗣️🧪💥🛡️⚙️🎓←→↑↓▲▼·—…·:：,，.。!！?？、;；""''（）【】《》·\-\d]*?)(\s*)</g,
      (match, sp1, text, sp2) => {
        const core = text.trim();
        if (!core || !CJK.test(core)) return match;
        if (core.includes('{') || core.includes('}')) return match; // Has JSX expressions
        if (core.includes('<') || core.includes('>')) return match; // Nested tags
        const key = `${base}.k${idx++}`;
        keys[key] = core;
        changed = true;
        return `>{i18n.t('${key}')}<`;
      }
    );
    
    // Pattern C: Template literals with CJK (inside JSX expressions or code)
    // Only simple ones without ${} interpolation
    newLine = newLine.replace(
      /`([^`]*[\u4e00-\u9fff][^`]*)`/g,
      (match, inner) => {
        if (!CJK.test(inner)) return match;
        if (inner.includes('i18n.t(')) return match;
        if (inner.includes('${')) return match; // Skip complex templates
        const key = `${base}.k${idx++}`;
        keys[key] = inner;
        changed = true;
        return `i18n.t('${key}')`;
      }
    );
    
    // Pattern D: Single-quoted CJK strings (in code context, not JSX attrs)
    // Skip if it's already an i18n.t() call or a key reference
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

// Scan ALL .tsx/.ts files in src/
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

console.log(`\n=== R91 JSX v2 ===`);
console.log(`Files: ${filesChanged}, Chars: -${totalRemoved}, Keys: ${Object.keys(allKeys).length}`);

fs.writeFileSync('scripts/i18n-r91-jsx-keys.json', JSON.stringify(allKeys, null, 2), 'utf8');
console.log('Keys saved.');
