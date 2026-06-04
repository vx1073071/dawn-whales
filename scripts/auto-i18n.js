/**
 * Auto i18n extractor — scans .tsx files for hardcoded Chinese text
 * and generates replacement suggestions + locale key mappings.
 *
 * Usage: node scripts/auto-i18n.js
 * Output: scripts/i18n-report.json
 */
const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = 'src/components';
const OUTPUT_FILE = 'scripts/i18n-report.json';

// Skip these patterns (comments, imports, etc.)
const SKIP_PATTERNS = [
  /^\s*\/\//,           // line comments
  /^\s*\*/,             // block comment lines
  /import\s+.*\s+from/, // import statements
  /\/\*.*\*\//,         // inline comments
  /className=/,         // tailwind classes with chinese chars are rare
];

function shouldSkipLine(line) {
  return SKIP_PATTERNS.some(p => p.test(line));
}

function extractChineseStrings(content) {
  const results = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (shouldSkipLine(line)) continue;

    // Find Chinese text inside JSX or string literals
    // Pattern: >中文< or "中文" or '中文'
    const patterns = [
      { regex: />([^<>]*[\u4e00-\u9fff][^<>]*)</g, type: 'jsx' },
      { regex: /"([^"]*[\u4e00-\u9fff][^"]*)"/g, type: 'string' },
      { regex: /'([^']*[\u4e00-\u9fff][^']*)'/g, type: 'string' },
    ];

    for (const { regex, type } of patterns) {
      let m;
      while ((m = regex.exec(line)) !== null) {
        const text = m[1].trim();
        if (text.length > 0 && text.length < 100) {
          results.push({ line: i + 1, text, type, original: m[0] });
        }
      }
    }
  }

  return results;
}

function generateKey(text) {
  // Generate a locale key from Chinese text
  // e.g. "健康检查" -> "healthCheck"
  const map = {
    '健康检查': 'healthCheck',
    '刷新': 'refresh',
    '加载中': 'loading',
    '错误': 'error',
    '成功': 'success',
    '取消': 'cancel',
    '确认': 'confirm',
    '保存': 'save',
    '删除': 'delete',
  };

  if (map[text]) return map[text];

  // Generate a simple hash-based key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `auto_${Math.abs(hash).toString(36)}`;
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = extractChineseStrings(content);
      if (matches.length > 0) {
        results.push({
          file: fullPath.replace(/\\/g, '/'),
          count: matches.length,
          matches: matches.map(m => ({
            ...m,
            suggestedKey: generateKey(m.text)
          }))
        });
      }
    }
  }
  return results;
}

const report = walk(COMPONENTS_DIR);
report.sort((a, b) => b.count - a.count);

// Generate summary
const totalFiles = report.length;
const totalStrings = report.reduce((sum, r) => sum + r.count, 0);
const allKeys = new Map();

for (const r of report) {
  for (const m of r.matches) {
    if (!allKeys.has(m.text)) {
      allKeys.set(m.text, m.suggestedKey);
    }
  }
}

const output = {
  summary: {
    totalFiles,
    totalStrings,
    uniqueStrings: allKeys.size,
    generatedAt: new Date().toISOString()
  },
  files: report.slice(0, 30),
  localeKeys: Object.fromEntries(allKeys)
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
console.log(`Scanned ${totalFiles} files, ${totalStrings} strings, ${allKeys.size} unique`);
console.log(`Report written to ${OUTPUT_FILE}`);
console.log('\nTop 10 files by count:');
for (const r of report.slice(0, 10)) {
  console.log(`  ${r.count.toString().padStart(3)} ${r.file}`);
}
