const fs = require('fs');
const path = require('path');

// R89-excluded test files (lines 93-127 of vitest.config.ts)
const r89Excludes = [
  'tests/q56-01-four-agent-collaboration.test.ts',
  'tests/q56-03-e2e-4agent-flow.test.ts',
  'tests/q58-02-creator-cost-e2e.test.ts',
  'tests/q58-03-regression-validation.test.ts',
  'tests/q59-02-commission-topup-e2e.test.ts',
  'tests/q69-02-guest-perf-e2e.test.ts',
  'tests/q70-02-deploy-fullchain-e2e.test.ts',
  'tests/q72-02-factor-compare-portfolio.test.ts',
  'tests/q73-01-realdata-draw-pattern.test.ts',
  'tests/q73-02-onboarding-param-e2e.test.ts',
  'tests/q74-01-build-deploy-verify.test.ts',
  'tests/q74-02-regression-gate-5800.test.ts',
  'tests/q75-01-real-vs-mock-compare.test.ts',
  'tests/q75-02-multisource-fallback-cache.test.ts',
  'tests/q76-01-usemock-crash-recovery.test.ts',
  'tests/q76-02-content-safety-gdpr.test.ts',
  'tests/q77-02-etimedout-fix.test.ts',
  'tests/q78-01-three-engine-tests.test.ts',
  'tests/q78-03-regression-6250.test.ts',
  'tests/q79-02-coverage-gate-60.test.ts',
  'tests/q50-03-coverage-boost.test.ts',
  // R89: moved files
  'tests/t53-crypto-service.test.ts',
  'tests/t61-t62-error-metrics.test.ts',
  'tests/jvs-49-data-versioning.test.ts',
  'tests/jvs-50-realtime-quality-monitor.test.ts',
  'tests/jvs-83-data-aggregator.test.ts',
  'tests/jvs-83-benchmark.test.ts',
  'tests/jvs-100-e2e-validation.test.ts',
  'tests/jvs-115-aggregator.test.ts',
  'tests/jvs-integration.test.ts',
  'tests/ws-backfill.test.ts',
  'tests/integration-full-pipeline.test.ts',
  'tests/benchmark-engines.test.ts',
  'tests/q47-property-testing.test.ts',
];

// Also pre-R89 excludes
const preR89Excludes = [
  'tests/q79-01-i18n-consistency.test.ts',
  'tests/q79-03-excluded-migration.test.ts',
  'tests/engine.test.ts',
  'tests/e2e-pipeline.test.ts',
  'tests/kelly-sizing.test.ts',
  'tests/strategy-execute-integration.test.ts',
  'tests/q35-trading-components.test.tsx',
  'tests/q51-chaos-engineering.test.ts',
  'tests/jvs-21-22-23-optimizers.test.ts',
  'tests/jvs-116-ws-perf-standalone.ts',
  'tests/jvs-117-cache-standalone.ts',
  'tests/jvs-118-signal-agg-standalone.ts',
  'tests/jvs-119-orderbook-standalone.ts',
  'tests/jvs-21-22-23-standalone.ts',
  'tests/j-38-01-kline-replay.test.ts',
  'tests/j-38-02-multi-timeframe.test.ts',
  'tests/jvs-57-02-agent-technical.test.ts',
  'tests/q60-03-regression.test.ts',
  'tests/q61-03-regression.test.ts',
  'tests/q62-03-regression.test.ts',
  'tests/q63-03-regression.test.ts',
  'tests/q64-03-regression.test.ts',
  'tests/q65-03-regression.test.ts',
  'tests/q66-03-regression.test.ts',
  'tests/q67-01-regression-gate.test.ts',
  'tests/q67-02-build-artifact.test.ts',
  'tests/q68-03-regression-gate.test.ts',
  'tests/q69-03-regression-gate.test.ts',
  'tests/q70-01-packaging-verification.test.ts',
  'tests/q71-01-r70-wrapup-ga-final.test.ts',
  'tests/q71-02-regression-gate-5600.test.ts',
  'tests/q73-03-regression-gate-5800.test.ts',
  'tests/q75-03-regression-gate-5800.test.ts',
  'tests/q76-03-regression-gate-6000.test.ts',
  'tests/q77-03-flaky-regression-6100.test.ts',
  'tests/q79-05-regression-6400.test.ts',
  'tests/q80-03-regression-6500.test.ts',
  'tests/q81-01-regression-6500-5r.test.ts',
  'tests/q81-02-fullchain-e2e-final.test.ts',
  'tests/trade-executor-ipc.test.ts',
];

console.log('=== R89 EXCLUDED TESTS ANALYSIS ===\n');

// Engine subdir mapping
const engineSubdirs = ['agents', 'analysis', 'backtest', 'core', 'data', 'factors', 'portfolio', 'risk'];

function findNewPath(oldImport) {
  // old: electron/engine/foo  →  new: electron/engine/subdir/foo
  for (const sub of engineSubdirs) {
    const candidate = oldImport.replace('electron/engine/', 'electron/engine/' + sub + '/');
    if (fs.existsSync(candidate + '.ts')) return candidate;
  }
  return null;
}

let fixable = [];
let stalePathOnly = [];
let complex = [];
let missing = [];

r89Excludes.forEach(function(tf) {
  const fp = tf;
  if (!fs.existsSync(fp)) {
    missing.push(tf);
    return;
  }
  const content = fs.readFileSync(fp, 'utf8');
  const lines = content.split('\n');
  
  // Find all imports from engine/
  const imports = [];
  const oldFlatImports = [];
  lines.forEach(function(line, i) {
    const m = line.match(/from\s+['"]\.\.\/electron\/engine\/([^'"]+)['"]/);
    if (m) {
      imports.push({ line: i+1, module: m[1], full: line.trim() });
      // Check if this is a flat import (no subdir)
      if (!m[1].includes('/')) {
        oldFlatImports.push({ line: i+1, module: m[1], full: line.trim() });
      }
    }
    // Also check for readdirSync / file count checks
    const rm = line.match(/readdirSync.*engine/);
    if (rm) {
      oldFlatImports.push({ line: i+1, module: 'readdirSync-engine', full: line.trim() });
    }
  });
  
  const hasOldFlat = oldFlatImports.length > 0;
  const hasReaddir = content.includes('readdirSync') && content.includes('engine');
  const hasFileCount = content.includes('>=310') || content.includes('>=300') || content.includes('fileCount');
  const lineCount = lines.length;
  
  let category = 'complex';
  let fixNotes = '';
  
  if (oldFlatImports.length === 0 && !hasReaddir && !hasFileCount) {
    category = 'stale-path-only';
    fixNotes = 'No flat engine imports found. Issue may be runtime/API not import path.';
  } else if (hasFileCount || hasReaddir) {
    category = 'complex';
    fixNotes = 'Checks engine file counts or readdirSync — needs test logic rewrite for subdir structure.';
  } else {
    // Try to find new paths
    let allFixable = true;
    oldFlatImports.forEach(function(imp) {
      const newPath = findNewPath('../electron/engine/' + imp.module);
      if (newPath) {
        fixNotes += 'L' + imp.line + ': ' + imp.module + ' -> ' + newPath.replace('../', '') + '\n';
      } else {
        allFixable = false;
        fixNotes += 'L' + imp.line + ': ' + imp.module + ' -> NOT FOUND\n';
      }
    });
    category = allFixable ? 'fixable' : 'complex';
  }
  
  const entry = {
    file: tf,
    lines: lineCount,
    flatImports: oldFlatImports.length,
    category: category,
    notes: fixNotes.trim()
  };
  
  if (category === 'fixable') fixable.push(entry);
  else if (category === 'stale-path-only') stalePathOnly.push(entry);
  else complex.push(entry);
});

console.log('FIXABLE (import path fix only):', fixable.length);
fixable.forEach(function(e) {
  console.log('  ' + e.file + ' (' + e.lines + 'L, ' + e.flatImports + ' imports)');
  console.log('    ' + e.notes.replace(/\n/g, '\n    '));
});

console.log('\nSTALE PATH ONLY (no flat imports, issue elsewhere):', stalePathOnly.length);
stalePathOnly.forEach(function(e) {
  console.log('  ' + e.file + ' (' + e.lines + 'L)');
  if (e.notes) console.log('    ' + e.notes);
});

console.log('\nCOMPLEX (needs test logic rewrite):', complex.length);
complex.forEach(function(e) {
  console.log('  ' + e.file + ' (' + e.lines + 'L, ' + e.flatImports + ' flat imports)');
  if (e.notes) console.log('    ' + e.notes.replace(/\n/g, '\n    '));
});

console.log('\nMISSING (file not found):', missing.length);
missing.forEach(function(f) { console.log('  ' + f); });

console.log('\n=== PRE-R89 EXCLUDES ===');
let preExists = 0, preMissing = 0;
preR89Excludes.forEach(function(tf) {
  if (fs.existsSync(tf)) preExists++;
  else preMissing++;
});
console.log('Pre-R89 excludes:', preR89Excludes.length, '(exist:', preExists, ', missing:', preMissing, ')');
console.log('\nTOTAL excluded:', r89Excludes.length + preR89Excludes.length);
