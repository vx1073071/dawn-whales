// R90 M-02: Process electron template literals and multi-line Chinese
// Strategy: Read each file, find CJK in code (not comments), 
// replace with i18n.t() calls. Handle template literals carefully.

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

// Process a file: replace Chinese in ALL code contexts (not comments)
function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  const oldChars = countCJK(content);
  const base = fileBase(filePath);
  const keys = {};
  let idx = 0;

  // Track if we're inside a multi-line comment
  let inBlockComment = false;
  const lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track block comments
    if (trimmed.startsWith('/*')) { inBlockComment = true; }
    if (trimmed.endsWith('*/')) { inBlockComment = false; continue; }
    if (inBlockComment) continue;

    // Skip single-line comments
    if (trimmed.startsWith('//')) continue;
    // Skip import lines
    if (trimmed.startsWith('import ')) continue;

    // Handle inline comments: split at // and only process the code part
    let codePart = line;
    let commentPart = '';
    // Find // that's not inside a string
    const commentIdx = findCommentStart(line);
    if (commentIdx >= 0) {
      codePart = line.substring(0, commentIdx);
      commentPart = line.substring(commentIdx);
    }

    let newCodePart = codePart;

    // 1. Replace single-quoted strings with CJK
    newCodePart = newCodePart.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, inner) => {
      if (!CJK.test(inner)) return match;
      const key = `${base}.k${idx++}`;
      keys[key] = inner;
      changed = true;
      return `i18n.t('${key}')`;
    });

    // 2. Replace double-quoted strings with CJK
    newCodePart = newCodePart.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, inner) => {
      if (!CJK.test(inner)) return match;
      const key = `${base}.k${idx++}`;
      keys[key] = inner;
      changed = true;
      return `i18n.t('${key}')`;
    });

    // 3. Replace simple template literals (no ${} interpolation)
    newCodePart = newCodePart.replace(/`([^`]*?)`/g, (match, inner) => {
      if (!CJK.test(inner)) return match;
      if (inner.includes('${')) return match; // Skip complex templates
      const key = `${base}.k${idx++}`;
      keys[key] = inner;
      changed = true;
      return `i18n.t('${key}')`;
    });

    if (newCodePart !== codePart) {
      lines[i] = newCodePart + commentPart;
    }
  }

  if (!changed) return { removed: 0, keyCount: 0 };

  // Handle multi-line template literals
  // Find backtick-delimited blocks that span multiple lines
  content = lines.join('\n');
  content = replaceMultiLineTemplates(content, base, keys, () => idx++);
  
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

function findCommentStart(line) {
  let inSingle = false, inDouble = false, inBacktick = false;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (c === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    if (c === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    if (c === '`' && !inSingle && !inDouble) inBacktick = !inBacktick;
    if (c === '/' && line[i + 1] === '/' && !inSingle && !inDouble && !inBacktick) return i;
  }
  return -1;
}

function replaceMultiLineTemplates(content, base, keys, nextIdx) {
  // Find multi-line template literals containing CJK
  // Pattern: `...CJK...\n...CJK...\n...`
  // Replace Chinese text segments within them
  
  let result = '';
  let i = 0;
  
  while (i < content.length) {
    if (content[i] === '`') {
      // Find matching closing backtick
      let j = i + 1;
      let depth = 0;
      while (j < content.length) {
        if (content[j] === '\\' ) { j += 2; continue; }
        if (content[j] === '$' && content[j + 1] === '{') { depth++; j += 2; continue; }
        if (content[j] === '}' && depth > 0) { depth--; j++; continue; }
        if (content[j] === '`' && depth === 0) break;
        j++;
      }
      
      if (j >= content.length) {
        result += content[i];
        i++;
        continue;
      }
      
      const templateContent = content.substring(i + 1, j);
      
      if (CJK.test(templateContent) && templateContent.includes('\n')) {
        // Multi-line template with CJK - process it
        let processed = templateContent;
        
        // Replace Chinese text segments (not inside ${} expressions)
        // Split by ${...} expressions, process each text segment
        const segments = splitByExpressions(processed);
        const newSegments = segments.map(seg => {
          if (seg.isExpr) return seg.text;
          // Replace Chinese text in this segment
          return seg.text.replace(/([\u4e00-\u9fff\u3400-\u4dbf][^\n$]*?)(?=\n|$|\$\{)/g, (match) => {
            const trimmed = match.trim();
            if (!trimmed || trimmed.length < 2) return match;
            const key = `${base}.k${nextIdx()}`;
            keys[key] = trimmed;
            return `\${i18n.t('${key}')}`;
          });
        });
        
        result += '`' + newSegments.map(s => s.text || s).join('') + '`';
      } else {
        result += content.substring(i, j + 1);
      }
      
      i = j + 1;
    } else {
      result += content[i];
      i++;
    }
  }
  
  return result;
}

function splitByExpressions(text) {
  const segments = [];
  let i = 0;
  let start = 0;
  
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '{') {
      // Text before this expression
      if (i > start) {
        segments.push({ text: text.substring(start, i), isExpr: false });
      }
      // Find matching }
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        if (text[j] === '}') depth--;
        j++;
      }
      segments.push({ text: text.substring(i, j), isExpr: true });
      start = j;
      i = j;
    } else {
      i++;
    }
  }
  
  if (start < text.length) {
    segments.push({ text: text.substring(start), isExpr: false });
  }
  
  return segments;
}

// Main
const targets = [
  'electron/engine/analysis/trading-dashboard.ts',
  'electron/engine/agents/ai-report-generator.ts',
  'electron/engine/data/sector-rotation-v2.ts',
  'electron/engine/agents/nl-parser.ts',
  'electron/engine/portfolio/portfolio-risk-calculator.ts',
  'electron/engine/risk/liquidity-risk.ts',
  'electron/engine/data/multi-market-broker.ts',
  'electron/engine/factors/multi-factor.ts',
  'electron/data/em-data-provider.ts',
  'electron/engine/agents/ai-drawing-engine.ts',
  'electron/engine/analysis/capital-flow-monitor.ts',
  'electron/engine/data/quote-stream.ts',
  'electron/engine/portfolio/hedging-optimizer.ts',
  'electron/engine/portfolio/portfolio-review.ts',
  'electron/engine/risk/correlation-alert.ts',
  'electron/engine/risk/macro-alert.ts',
  'electron/engine/risk/risk-report-generator.ts',
  'electron/engine/risk/stress-test-v2.ts',
  'electron/ipc/broker-ipc.ts',
  'electron/main/browser.ts',
  'electron/main/updater.ts',
  'electron/data/data-provider.ts',
  'electron/data/data-versioning.ts',
  'electron/data/database.ts',
  'electron/data/lru-cache.ts',
  'electron/data/marketplace-service.ts',
  'electron/data/push2-proxy.ts',
  'electron/engine/risk/risk-engine.ts',
  'electron/engine/analysis/live-trade-bridge.ts',
  'electron/engine/portfolio/rebalance-engine.ts',
  'electron/engine/risk/compliance-report-engine.ts',
  'electron/engine/risk/anomaly-detection.ts',
  'electron/engine/risk/volume-trigger.ts',
  'electron/engine/risk/price-trigger.ts',
  'electron/engine/portfolio/audit-trail-engine.ts',
  'electron/engine/portfolio/parameter-scanner-v2.ts',
  'electron/engine/data/margin-data.ts',
  'electron/engine/analysis/strategy-ensemble.ts',
  'electron/engine/analysis/anomaly-detector.ts',
  'electron/engine/risk/indicator-trigger.ts',
  'electron/engine/data/data-pipeline-reliability.ts',
  'electron/engine/agents/nlp-sentiment-engine.ts',
  'electron/engine/analysis/capital-flow-rank.ts',
  'electron/engine/backtest/walk-forward.ts',
  'electron/engine/backtest/backtest-engine-parallel.ts',
  'electron/engine/analysis/strategy-marketplace-search.ts',
  'electron/engine/data/consumer-data.ts',
  'electron/engine/data/dragon-tiger-list.ts',
  'electron/engine/data/market-breadth.ts',
  'electron/engine/data/earnings-calendar.ts',
  'electron/engine/data/fund-holdings.ts',
  'electron/engine/data/financial-reports.ts',
];

const allKeys = {};
let totalRemoved = 0;
let filesChanged = 0;

for (const file of targets) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  
  const result = processFile(file);
  if (result.removed > 0) {
    console.log(`  ${file}: -${result.removed} (${result.keyCount} keys)`);
    Object.assign(allKeys, result.keys);
    totalRemoved += result.removed;
    filesChanged++;
  }
}

console.log(`\n=== M-02 Result ===`);
console.log(`Files: ${filesChanged}`);
console.log(`Chars removed: ${totalRemoved}`);
console.log(`Keys: ${Object.keys(allKeys).length}`);

fs.writeFileSync('scripts/i18n-r90-m02-keys.json', JSON.stringify(allKeys, null, 2), 'utf8');
console.log('Keys saved.');
