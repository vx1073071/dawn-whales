#!/usr/bin/env node
/**
 * Performance Baseline Automation Script
 * 
 * Usage:
 *   node scripts/perf-baseline.js           # Run full baseline
 *   node scripts/perf-baseline.js --compare # Compare with R20 baseline
 *   node scripts/perf-baseline.js --json    # Output JSON for CI
 * 
 * TODO (QClaw R21):
 *   - Fix test result parsing: vitest output may be on stderr or contain ANSI codes
 *   - Fix build time parsing: electron/preload times may need multi-stage matching
 *   - Add bundle size diff detection (flag >10% growth)
 *   - Add CI integration (.github/workflows/perf.yml)
 * 
 * Records:
 *   - Build time (vite + electron + preload)
 *   - Test suite time + pass/fail/skip counts
 *   - tsc --noEmit time
 *   - Bundle sizes (dist + dist-electron)
 *   - IPC handler count
 *   - Comparison with R20 baseline
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const R20_BASELINE = {
  round: 'R20',
  date: '2026-06-06T03:10:00+08:00',
  buildTimeMs: 4890 + 628 + 9, // vite + electron + preload
  tscTimeMs: 4500, // estimated
  testTimeMs: 7020,
  testsPassed: 576,
  testsFailed: 0,
  testsSkipped: 8,
  testFilesPassed: 77,
  testFilesSkipped: 1,
  bundleSizeKB: {
    'dist/assets/index': 313.73,
    'dist/assets/DailyPnLSummary': 1050.64,
    'dist-electron/main.cjs': 1114.03,
    'dist-electron/preload.cjs': 12.35,
  },
  ipcHandlers: 448,
  cssWarnings: 0,
};

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function color(val, threshold, reverse = false) {
  if (reverse) {
    return val > threshold ? COLORS.red : COLORS.green;
  }
  return val < threshold ? COLORS.green : val > threshold * 1.5 ? COLORS.red : COLORS.yellow;
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function runCommand(cmd, cwd = process.cwd()) {
  const start = Date.now();
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000,
    });
    return { success: true, output, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      output: err.stdout || '',
      stderr: err.stderr || '',
      duration: Date.now() - start,
      exitCode: err.status,
    };
  }
}

function parseTestResults(output) {
  const lines = output.split('\n');
  const result = {
    testFilesPassed: 0,
    testFilesFailed: 0,
    testFilesSkipped: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
  };

  for (const line of lines) {
    // Test Files  77 passed | 1 skipped (78)
    const tfMatch = line.match(/Test Files\s+(\d+)\s+passed\s*\|\s*(\d+)\s+skipped\s*\((\d+)\)/);
    if (tfMatch) {
      result.testFilesPassed = parseInt(tfMatch[1]);
      result.testFilesSkipped = parseInt(tfMatch[2]);
    }
    const tfMatch2 = line.match(/Test Files\s+(\d+)\s+passed\s*\|\s*(\d+)\s+failed/);
    if (tfMatch2) {
      result.testFilesPassed = parseInt(tfMatch2[1]);
      result.testFilesFailed = parseInt(tfMatch2[2]);
    }

    // Tests  576 passed | 8 skipped (584)
    const tMatch = line.match(/Tests\s+(\d+)\s+passed\s*\|\s*(\d+)\s+skipped\s*\((\d+)\)/);
    if (tMatch) {
      result.testsPassed = parseInt(tMatch[1]);
      result.testsSkipped = parseInt(tMatch[2]);
    }
    const tMatch2 = line.match(/Tests\s+(\d+)\s+passed\s*\|\s*(\d+)\s+failed/);
    if (tMatch2) {
      result.testsPassed = parseInt(tMatch2[1]);
      result.testsFailed = parseInt(tMatch2[2]);
    }

    // Duration  7.02s
    const dMatch = line.match(/Duration\s+([\d.]+)s/);
    if (dMatch) {
      result.durationMs = parseFloat(dMatch[1]) * 1000;
    }
  }

  return result;
}

function parseBuildOutput(output) {
  const result = { viteTimeMs: 0, electronTimeMs: 0, preloadTimeMs: 0, sizes: {} };
  const lines = output.split('\n');

  for (const line of lines) {
    // ✓ built in 4.89s
    const buildMatch = line.match(/built in ([\d.]+)s/);
    if (buildMatch) {
      const ms = parseFloat(buildMatch[1]) * 1000;
      if (result.viteTimeMs === 0) result.viteTimeMs = ms;
      else if (result.electronTimeMs === 0) result.electronTimeMs = ms;
      else result.preloadTimeMs = ms;
    }

    // dist/assets/index-DP5zxYaR.js                     313.73 kB
    const sizeMatch = line.match(/(dist[\/\w.-]+)\s+([\d.]+)\s+kB/);
    if (sizeMatch) {
      const name = sizeMatch[1].replace(/-[A-Za-z0-9]+\./, '.'); // strip hash
      result.sizes[name] = parseFloat(sizeMatch[2]);
    }
  }

  return result;
}

function countIpcHandlers() {
  const ipcDir = path.join(process.cwd(), 'electron', 'ipc');
  if (!fs.existsSync(ipcDir)) return 0;

  let count = 0;
  const files = fs.readdirSync(ipcDir).filter(f => f.endsWith('-ipc.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(ipcDir, file), 'utf-8');
    // Count ipcMain.handle patterns
    const matches = content.match(/ipcMain\.handle\(/g);
    if (matches) count += matches.length;
  }
  return count;
}

function getBundleSizes() {
  const distDir = path.join(process.cwd(), 'dist');
  const distElectronDir = path.join(process.cwd(), 'dist-electron');
  const sizes = {};

  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const key = prefix + '/' + entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, prefix + '/' + entry.name);
      } else {
        const stat = fs.statSync(fullPath);
        sizes[key] = stat.size;
      }
    }
  }

  walk(distDir, 'dist');
  walk(distElectronDir, 'dist-electron');
  return sizes;
}

function generateReport(current, baseline, compare = false) {
  const now = new Date().toISOString();
  const buildTotal = current.viteTimeMs + current.electronTimeMs + current.preloadTimeMs;
  const baselineBuildTotal = baseline.buildTimeMs;

  let md = `# Performance Baseline Report\n\n`;
  md += `**Generated**: ${now}\n`;
  md += `**Round**: R21\n\n`;

  md += `## Build Metrics\n\n`;
  md += `| Metric | Current | Baseline (R20) | Delta | Status |\n`;
  md += `|--------|---------|----------------|-------|--------|\n`;

  const buildDelta = buildTotal - baselineBuildTotal;
  const buildStatus = buildDelta < 500 ? '✅' : buildDelta < 2000 ? '⚠️' : '🔴';
  md += `| Total Build Time | ${formatMs(buildTotal)} | ${formatMs(baselineBuildTotal)} | ${buildDelta > 0 ? '+' : ''}${formatMs(buildDelta)} | ${buildStatus} |\n`;
  md += `| Vite Build | ${formatMs(current.viteTimeMs)} | ${formatMs(4890)} | ${(current.viteTimeMs - 4890) > 0 ? '+' : ''}${formatMs(current.viteTimeMs - 4890)} | |\n`;
  md += `| Electron Build | ${formatMs(current.electronTimeMs)} | ${formatMs(628)} | ${(current.electronTimeMs - 628) > 0 ? '+' : ''}${formatMs(current.electronTimeMs - 628)} | |\n`;
  md += `| Preload Build | ${formatMs(current.preloadTimeMs)} | ${formatMs(9)} | ${(current.preloadTimeMs - 9) > 0 ? '+' : ''}${formatMs(current.preloadTimeMs - 9)} | |\n`;

  md += `\n## Test Metrics\n\n`;
  md += `| Metric | Current | Baseline (R20) | Delta | Status |\n`;
  md += `|--------|---------|----------------|-------|--------|\n`;

  const testDelta = current.testDurationMs - baseline.testTimeMs;
  const testStatus = current.testsFailed === 0 ? '✅' : '🔴';
  md += `| Test Duration | ${formatMs(current.testDurationMs)} | ${formatMs(baseline.testTimeMs)} | ${testDelta > 0 ? '+' : ''}${formatMs(testDelta)} | ${testStatus} |\n`;
  md += `| Tests Passed | ${current.testsPassed} | ${baseline.testsPassed} | ${current.testsPassed - baseline.testsPassed > 0 ? '+' : ''}${current.testsPassed - baseline.testsPassed} | ${current.testsPassed >= baseline.testsPassed ? '✅' : '🔴'} |\n`;
  md += `| Tests Failed | ${current.testsFailed} | ${baseline.testsFailed} | ${current.testsFailed - baseline.testsFailed > 0 ? '+' : ''}${current.testsFailed - baseline.testsFailed} | ${current.testsFailed === 0 ? '✅' : '🔴'} |\n`;
  md += `| Tests Skipped | ${current.testsSkipped} | ${baseline.testsSkipped} | ${current.testsSkipped - baseline.testsSkipped > 0 ? '+' : ''}${current.testsSkipped - baseline.testsSkipped} | |\n`;
  md += `| Test Files Passed | ${current.testFilesPassed} | ${baseline.testFilesPassed} | ${current.testFilesPassed - baseline.testFilesPassed > 0 ? '+' : ''}${current.testFilesPassed - baseline.testFilesPassed} | |\n`;

  md += `\n## TypeScript Check\n\n`;
  md += `| Metric | Current | Status |\n`;
  md += `|--------|---------|--------|\n`;
  md += `| tsc --noEmit | ${formatMs(current.tscTimeMs)} | ${current.tscErrors === 0 ? '✅ 0 errors' : '🔴 ' + current.tscErrors + ' errors'} |\n`;

  md += `\n## Bundle Analysis\n\n`;
  md += `| File | Size | Baseline | Delta |\n`;
  md += `|------|------|----------|-------|\n`;

  for (const [name, size] of Object.entries(current.sizes)) {
    if (name.endsWith('.map')) continue; // skip sourcemaps
    const baselineSize = baseline.bundleSizeKB[name];
    const delta = baselineSize ? size - baselineSize : 0;
    const deltaStr = baselineSize ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)} KB` : 'N/A';
    md += `| ${name} | ${size.toFixed(2)} KB | ${baselineSize ? baselineSize + ' KB' : 'N/A'} | ${deltaStr} |\n`;
  }

  md += `\n## IPC Handlers\n\n`;
  md += `| Metric | Current | Baseline | Status |\n`;
  md += `|--------|---------|----------|--------|\n`;
  md += `| Registered Handlers | ${current.ipcHandlers} | ${baseline.ipcHandlers} | ${current.ipcHandlers >= baseline.ipcHandlers ? '✅' : '⚠️'} |\n`;

  md += `\n## Overall Status\n\n`;
  const overallOk = current.testsFailed === 0 && current.tscErrors === 0 && buildTotal < baselineBuildTotal * 1.5;
  md += overallOk ? '🟢 **PASS** — All metrics within acceptable range\n' : '🔴 **FAIL** — Regression detected, see details above\n';

  md += `\n---\n`;
  md += `*This report was auto-generated by scripts/perf-baseline.js*\n`;

  return md;
}

async function main() {
  const args = process.argv.slice(2);
  const compare = args.includes('--compare');
  const json = args.includes('--json');
  const quiet = args.includes('--quiet');

  if (!quiet) console.log(COLORS.cyan + '📊 Performance Baseline — R21' + COLORS.reset);

  const results = {
    round: 'R21',
    timestamp: new Date().toISOString(),
    viteTimeMs: 0,
    electronTimeMs: 0,
    preloadTimeMs: 0,
    tscTimeMs: 0,
    tscErrors: 0,
    testDurationMs: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
    testFilesPassed: 0,
    testFilesFailed: 0,
    testFilesSkipped: 0,
    sizes: {},
    ipcHandlers: 0,
  };

  // 1. TypeScript check
  if (!quiet) console.log('⏳ Running tsc --noEmit...');
  const tscResult = runCommand('npx tsc --noEmit');
  results.tscTimeMs = tscResult.duration;
  results.tscErrors = tscResult.success ? 0 : (tscResult.stderr.match(/error TS/g) || []).length;
  if (!quiet) {
    console.log(`   ${results.tscErrors === 0 ? COLORS.green + '✓' : COLORS.red + '✗'} ${formatMs(tscResult.duration)} — ${results.tscErrors} errors`);
  }

  // 2. Build
  if (!quiet) console.log('⏳ Running npm run build...');
  const buildResult = runCommand('npm run build');
  const buildParsed = parseBuildOutput(buildResult.output + '\n' + buildResult.stderr);
  results.viteTimeMs = buildParsed.viteTimeMs;
  results.electronTimeMs = buildParsed.electronTimeMs;
  results.preloadTimeMs = buildParsed.preloadTimeMs;
  Object.assign(results.sizes, buildParsed.sizes);
  if (!quiet) {
    console.log(`   ${buildResult.success ? COLORS.green + '✓' : COLORS.red + '✗'} Vite ${formatMs(results.viteTimeMs)} | Electron ${formatMs(results.electronTimeMs)} | Preload ${formatMs(results.preloadTimeMs)}`);
  }

  // 3. Tests
  if (!quiet) console.log('⏳ Running npm test -- --run...');
  const testResult = runCommand('npm test -- --run');
  const testParsed = parseTestResults(testResult.output + '\n' + testResult.stderr);
  Object.assign(results, testParsed);
  results.testDurationMs = testParsed.durationMs || testResult.duration;
  if (!quiet) {
    const testStatus = results.testsFailed === 0 ? COLORS.green + '✓' : COLORS.red + '✗';
    console.log(`   ${testStatus} ${formatMs(results.testDurationMs)} — ${results.testsPassed} pass / ${results.testsFailed} fail / ${results.testsSkipped} skip`);
  }

  // 4. IPC handlers
  results.ipcHandlers = countIpcHandlers();
  if (!quiet) console.log(`📡 IPC Handlers: ${results.ipcHandlers}`);

  // 5. Generate report
  const report = generateReport(results, R20_BASELINE, compare);
  const reportPath = path.join(process.cwd(), 'docs', 'tasks', 'perf-baseline-report-r21.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, 'utf-8');

  if (!quiet) {
    console.log('\n' + COLORS.cyan + '📝 Report saved to:' + COLORS.reset);
    console.log(`   ${reportPath}`);
  }

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  }

  // Exit with error if regression
  if (results.testsFailed > 0 || results.tscErrors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
