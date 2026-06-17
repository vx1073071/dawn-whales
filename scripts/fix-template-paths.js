const fs = require('fs');
const path = require('path');

// ── R281 autoclaw#2: Template Path Validator & Auto-Fixer ──────────────────
// Purpose: After JVS deduplicates factor engine files and ML deduplicates
// frontend components (73→fewer), ALL template import paths must be 
// verified and updated. This script:
//   1. Scans ALL .ts files in electron/engine/** for import statements
//   2. Resolves each relative import path against the filesystem
//   3. Reports broken imports
//   4. Optionally auto-fixes by finding the nearest match
//
// Usage:
//   node fix-template-paths.js --check          (dry run: list all imports + status)
//   node fix-template-paths.js --fix            (auto-fix broken imports)
//   node fix-template-paths.js --check --dir=strategies  (check only strategies/)

const ROOT = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const TARGET_DIRS = ['strategies', 'factors', 'analysis', 'data', 'news'];
const EXTENSIONS = ['.ts', '.tsx', '.json'];

// Known dedup mappings: old file → new consolidated file
// Populated by JVS after dedup. We provide sensible defaults.
const DEDUP_MAP = {
  // Strategy engines merged
  'strategy-engine': 'strategy-runner',
  'StrategyRecommender': 'strategy-runner',
  'StrategySandboxRunner': 'strategy-runner',
  
  // Backtest merges
  'backtest-confidence': 'factor-backtest-engine',
  'BacktestBenchmarkSuite': 'factor-backtest-engine',
  'template-backtest-runner': 'factor-backtest-engine',
  'backtest-cache': 'factor-backtest-engine',
  
  // Factor calculator merges
  'FactorCalculatorValidator': 'factor-calculator',
  'FactorCacheManager': 'factor-cache-layer',
  'FactorCacheManagerV2': 'factor-cache-layer',
  'WasmFactorCalculator': 'factor-calculator',
  'WasmHotPathEngine': 'factor-batch-compute',
  
  // Signal pipeline merges
  'strategy-signal-generator': 'factor-signal-pipeline',
  'strategy-signal-aggregator': 'factor-signal-pipeline',
  'strategy-signal-converter': 'factor-signal-pipeline',
  'signal-pipeline': 'factor-signal-pipeline',
  
  // Duplicate strategy modules
  'strategy-comparison-optimizer': 'strategy-optimizer',
  'strategy-marketplace-search': 'strategy-marketplace-api',
  'strategy-screener': 'strategy-marketplace-api',
  'strategy-monitor': 'strategy-run-log',
  'strategy-ranking-engine': 'strategy-marketplace-api',
  
  // Factor duplicate engines
  'factor-optimizer': 'factor-batch-optimizer',
  'factor-normalizer-v2': 'factor-preprocessor',
  'factor-sensitivity-analyzer': 'sensitivity-analyzer',
  'live-vs-backtest': 'live-vs-backtest-engine',
  'multi-factor': 'multi-factor-selector',
  'ic-calculator': 'factor-rolling-ic-monitor',
  
  // Duplicate analysis engines
  'strategy-optimizer': 'strategy-runner',
  'strategy-runner': 'strategy-runner',  // already canonical
  'strategy-explainer': 'strategy-runner',
  'strategy-export-import': 'strategy-export-import',
  'strategy-ensemble': 'strategy-runner',
  'strategy-live-backtest-validator': 'factor-backtest-engine',
  
  // Template definitions merged
  'template-definitions-hk': 'factor-strategy-templates-hk',
  'template-definitions-jp': 'factor-strategy-templates-jpkr',
  'template-definitions-kr': 'factor-strategy-templates-jpkr',
  'template-definitions-tw': 'factor-strategy-templates-apac',
  'template-definitions-sg': 'factor-strategy-templates-apac',
  'template-definitions-in': 'factor-strategy-templates-apac',
  'template-definitions-au': 'factor-strategy-templates-apac',
  'template-definitions-eu': 'factor-strategy-templates-euin',
  
  // Data module merges
  'strategy-combo-bridge': 'factor-marketplace-bridge',
  'template-pk-bridge': 'factor-combo-compare',
  'template-pk-completion': 'factor-combo-compare',
  'factor-marketplace-enhancer': 'factor-marketplace-bridge',
  'factor-marketplace-completion': 'factor-marketplace-bridge',
  
  // IPC bridge merges (R281 specific)
  'drawing-ipc-v5-bridge': 'community-ipc-v5-bridge',
  'shortcut-ipc-bridge': 'shortcut-global-v5-bridge',
  
  // Dedup Engine v2 absorbs v1
  'dedup-engine': 'dedup-engine-v2',
  
  // Price move engines merge
  'price-move-push-engine': 'price-move-attribution',
  'price-move-push-completion': 'price-move-attribution',
  'move-push-bridge': 'price-move-attribution',
  
  // Factor template variant merges
  'factor-strategy-templates-aisupplement': 'factor-strategy-templates-ai',
  'factor-strategy-templates-crosssupplement': 'factor-strategy-templates-ai',
  'factor-strategy-templates-hksupplement': 'factor-strategy-templates-hk',
  
  // Sector rotation merges
  'sector-rotation': 'sector-rotation-pipeline',
  'sector-rotation-v2': 'sector-rotation-pipeline',
  
  // Live executor duplicate
  'real-trader': 'live-executor',
  'live-trade-bridge': 'live-executor',
};

// ═══════════════════════════════════════════════════════════════
// SCANNER
// ═══════════════════════════════════════════════════════════════

/** Build a lookup of all .ts/.tsx files in target dirs */
function buildFileIndex() {
  const index = new Map(); // normalized basename → full relative path
  const allFiles = [];
  
  TARGET_DIRS.forEach(dir => {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) return;
    
    function scan(d) {
      fs.readdirSync(d, { withFileTypes: true }).forEach(entry => {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scan(full);
          }
        } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
          const rel = path.relative(ROOT, full).replace(/\\/g, '/');
          const base = entry.name.replace(/\.(ts|tsx)$/, '');
          allFiles.push(rel);
          
          // Index by basename (no extension)
          if (!index.has(base)) index.set(base, []);
          index.get(base).push(rel);
        }
      });
    }
    scan(fullDir);
  });
  
  return { index, allFiles };
}

/** Extract all relative imports from a file */
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  const regex = /from\s+['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push({
      raw: match[1],
      line: content.substring(0, match.index).split('\n').length,
    });
  }
  return imports;
}

/** Resolve a relative import to an actual filesystem path */
function resolveImport(fromFile, importPath) {
  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(ROOT, fromDir, importPath).replace(/\\/g, '/');
  const relToRoot = path.relative(ROOT, resolved).replace(/\\/g, '/');
  
  // Try exact match
  for (const ext of EXTENSIONS) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) return { found: true, path: relToRoot + ext, candidate };
  }
  
  // Try /index.ts
  for (const ext of EXTENSIONS) {
    const candidate = path.join(resolved, 'index' + ext);
    if (fs.existsSync(candidate)) return { found: true, path: relToRoot + '/index' + ext, candidate };
  }
  
  return { found: false, path: relToRoot, candidate: null };
}

/** Find the best replacement for a broken import */
function findReplacement(brokenBase, fileIndex) {
  // Check dedup map first
  if (DEDUP_MAP[brokenBase]) {
    const target = DEDUP_MAP[brokenBase];
    if (fileIndex.has(target)) {
      const candidates = fileIndex.get(target);
      for (const c of candidates) {
        if (c.startsWith('data/') || c.startsWith('factors/') || 
            c.startsWith('strategies/') || c.startsWith('analysis/') ||
            c.startsWith('news/')) {
          return c.replace(/\.tsx?$/, '');
        }
      }
      return candidates[0].replace(/\.tsx?$/, '');
    }
  }
  
  // Fuzzy match by name similarity
  let best = null;
  let bestScore = 0;
  const words = brokenBase.toLowerCase().split(/[-_]/);
  
  fileIndex.forEach((candidates, base) => {
    const baseWords = base.toLowerCase().split(/[-_]/);
    let score = 0;
    words.forEach(w => {
      if (baseWords.includes(w)) score += 2;
      baseWords.forEach(bw => {
        if (bw.includes(w) || w.includes(bw)) score += 1;
      });
    });
    if (score > bestScore) {
      bestScore = score;
      best = candidates[0].replace(/\.tsx?$/, '');
    }
  });
  
  return best;
}

/** Compute relative import path from file A to file B */
function relativeImport(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  // Strip extension
  rel = rel.replace(/\.(ts|tsx)$/, '');
  return rel;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--fix') ? 'fix' : 'check';
  const targetDirs = args.includes('--dir') 
    ? [args[args.indexOf('--dir') + 1]] 
    : TARGET_DIRS;
  
  console.log(`[R281] Template Path ${mode === 'fix' ? 'Auto-Fixer' : 'Validator'}`);
  console.log(`Target directories: ${targetDirs.join(', ')}`);
  console.log('');
  
  const { index, allFiles } = buildFileIndex();
  console.log(`Indexed ${allFiles.length} files across ${TARGET_DIRS.length} directories`);
  console.log(`Dedup map: ${Object.keys(DEDUP_MAP).length} known merges`);
  console.log('');
  
  let totalImports = 0;
  let brokenImports = 0;
  let fixedImports = 0;
  const brokenFiles = [];
  
  for (const dir of targetDirs) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    
    function scanDir(d) {
      fs.readdirSync(d, { withFileTypes: true }).forEach(entry => {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scanDir(full);
          }
        } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
          const rel = path.relative(ROOT, full).replace(/\\/g, '/');
          const imports = extractImports(full);
          totalImports += imports.length;
          
          const broken = [];
          imports.forEach(imp => {
            const result = resolveImport(rel, imp.raw);
            if (!result.found) {
              broken.push({ import: imp, resolved: result });
              brokenImports++;
            }
          });
          
          if (broken.length > 0) {
            brokenFiles.push({ file: rel, broken, full });
          }
        }
      });
    }
    scanDir(fullDir);
  }
  
  // ── Report ──
  console.log(`Total imports scanned: ${totalImports}`);
  console.log(`Broken imports found: ${brokenImports}`);
  console.log('');
  
  if (brokenFiles.length === 0) {
    console.log('✅ All import paths are valid! No fixes needed.');
    return;
  }
  
  console.log(`❌ ${brokenFiles.length} files have broken imports:`);
  console.log('');
  
  brokenFiles.forEach(({ file, broken, full }) => {
    console.log(`  📄 ${file}`);
    broken.forEach(({ import: imp, resolved }) => {
      const brokenBase = path.basename(resolved.path, '.ts').replace('/index', '');
      const replacement = findReplacement(brokenBase, index);
      
      console.log(`     ❌ Line ${imp.line}: "${imp.raw}" → ${resolved.path}`);
      if (replacement) {
        const newRel = relativeImport(file, replacement + '.ts');
        console.log(`     💡 Suggested: "${newRel}" (→ ${replacement})`);
        
        if (mode === 'fix') {
          // Apply the fix
          let content = fs.readFileSync(full, 'utf8');
          const oldImport = `from '${imp.raw}'`;
          const newImport = `from '${newRel}'`;
          if (content.includes(oldImport)) {
            content = content.replace(oldImport, newImport);
            fs.writeFileSync(full, content, 'utf8');
            console.log(`     ✅ FIXED: "${imp.raw}" → "${newRel}"`);
            fixedImports++;
          }
        }
      } else {
        console.log(`     ⚠️  No replacement found`);
      }
    });
    console.log('');
  });
  
  if (mode === 'fix') {
    console.log(`🔧 Fixed ${fixedImports} import paths in ${brokenFiles.length} files`);
  } else {
    console.log('💡 Run with --fix to auto-fix broken imports');
  }
  
  // ── Summary ──
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`Total: ${totalImports} imports | ${brokenImports} broken | ${mode === 'fix' ? fixedImports : '0'} fixed`);
  console.log('═══════════════════════════════════════');
}

main().catch(console.error);
