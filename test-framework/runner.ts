/**
 * QTest Runner - orchestrator with both parallel and sequential modes
 * Q44: 测试框架自建
 *
 * Supports:
 *  - Sequential (same process, isolated sandboxes via VM)
 *  - Parallel (worker_threads)
 *  - Isolated (child_process)
 */

import { runFilesSequential } from './core.js';
import { runParallel } from './parallel-runner.js';
import type { RunnerConfig, RunResult } from './types.js';
import { writeFile, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { performance } from 'node:perf_hooks';

// ============ Main run function ============

export async function run(
  files: string[],
  config: RunnerConfig = {
    concurrency: 4,
    isolate: true,
    workerType: 'thread',
    timeout: 5000,
    retry: 0,
    bail: 0,
    updateSnapshots: false,
    verbose: false,
    silent: false,
    coverage: false,
  }
): Promise<RunResult> {
  const startTime = performance.now();

  let result: RunResult;

  if (config.workerType === 'thread' && config.isolate) {
    result = await runParallel(files, config);
  } else if (config.workerType === 'same' || !config.isolate) {
    result = await runFilesSequential(files, config);
  } else {
    // child-process mode (fallback to sequential)
    result = await runFilesSequential(files, config);
  }

  // Generate reports
  if (!config.silent) {
    await generateTextReport(result, config);
    if (config.coverage) {
      // TODO: coverage report
    }
  }

  return result;
}

// ============ Text Report ============

async function generateTextReport(result: RunResult, config: RunnerConfig): Promise<void> {
  const { passed, failed, skipped, todo, totalTests, duration } = result;
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(60));
  lines.push(`  QTest Results`);
  lines.push('='.repeat(60));
  lines.push('');

  // Per-file results
  for (const suite of result.suites) {
    const statusIcon = suite.status === 'passed' ? '✓' : '✗';
    lines.push(`  ${statusIcon} ${suite.name} (${suite.file})`);
    lines.push(`    Tests: ${suite.tests.length} | Duration: ${suite.duration}ms`);
    lines.push('');

    for (const t of suite.tests) {
      const icon = t.status === 'passed' ? '  ✓' : t.status === 'failed' ? '  ✗' : '  -';
      const dur = t.duration > 0 ? ` (${t.duration}ms)` : '';
      lines.push(`    ${icon} ${t.name}${dur}`);
      if (t.status === 'failed' && t.error) {
        lines.push(`        Error: ${t.error.message}`);
        if (t.error.stack) {
          const stackLines = t.error.stack.split('\n').slice(0, 3).join('\n        ');
          lines.push(`        ${stackLines}`);
        }
      }
    }
    lines.push('');
  }

  // Summary
  lines.push('-'.repeat(60));
  lines.push(`  Total:  ${totalTests}`);
  lines.push(`  Passed: ${passed}`);
  lines.push(`  Failed: ${failed}`);
  if (skipped > 0) lines.push(`  Skipped: ${skipped}`);
  if (todo > 0) lines.push(`  Todo: ${todo}`);
  lines.push(`  Duration: ${(duration / 1000).toFixed(2)}s`);
  lines.push('-'.repeat(60));
  lines.push('');

  const output = lines.join('\n');
  console.log(output);

  // Write to file
  const reportPath = resolve('test-framework/qtest-report.txt');
  await writeFile(reportPath, output, 'utf-8');
}

// ============ HTML Report Generator ============

export async function generateHtmlReport(result: RunResult, outputPath?: string): Promise<string> {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>QTest Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #c9d1d9; padding: 2rem; }
    h1 { color: #58a6ff; margin-bottom: 1rem; }
    .summary { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.5rem; min-width: 120px; }
    .card .label { color: #8b949e; font-size: 0.85rem; }
    .card .value { font-size: 1.8rem; font-weight: bold; }
    .card.pass .value { color: #3fb950; }
    .card.fail .value { color: #f85149; }
    .card.skip .value { color: #8b949e; }
    .card.total .value { color: #58a6ff; }
    .suite { background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin-bottom: 1rem; overflow: hidden; }
    .suite-header { padding: 0.75rem 1rem; background: #1c2128; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .suite-header.passed { border-left: 4px solid #3fb950; }
    .suite-header.failed { border-left: 4px solid #f85149; }
    .suite-name { font-weight: 600; }
    .suite-meta { color: #8b949e; font-size: 0.85rem; }
    .test { padding: 0.5rem 1rem; border-top: 1px solid #21262d; display: flex; justify-content: space-between; align-items: center; }
    .test.passed { border-left: 3px solid #3fb950; }
    .test.failed { border-left: 3px solid #f85149; background: rgba(248,81,73,0.05); }
    .test.skipped { border-left: 3px solid #8b949e; opacity: 0.6; }
    .test-name { font-size: 0.9rem; }
    .test-dur { color: #8b949e; font-size: 0.8rem; }
    .error { padding: 0.5rem 1rem; background: rgba(248,81,73,0.1); color: #f85149; font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; }
    .badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 12px; font-weight: 600; }
    .badge.pass { background: rgba(63,185,80,0.15); color: #3fb950; }
    .badge.fail { background: rgba(248,81,73,0.15); color: #f85149; }
    .badge.skip { background: rgba(139,148,158,0.15); color: #8b949e; }
    .timestamp { color: #8b949e; font-size: 0.8rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>🧪 QTest Report</h1>
  <div class="summary">
    <div class="card total"><div class="label">Total</div><div class="value">${result.totalTests}</div></div>
    <div class="card pass"><div class="label">Passed</div><div class="value">${result.passed}</div></div>
    <div class="card fail"><div class="label">Failed</div><div class="value">${result.failed}</div></div>
    <div class="card skip"><div class="label">Skipped</div><div class="value">${result.skipped}</div></div>
  </div>

  ${result.suites.map(suite => `
  <div class="suite">
    <div class="suite-header ${suite.status}">
      <div>
        <span class="suite-name">${escHtml(suite.name)}</span>
        <span class="suite-meta">${escHtml(suite.file)} · ${suite.tests.length} tests · ${suite.duration}ms</span>
      </div>
      <span class="badge ${suite.status}">${suite.status.toUpperCase()}</span>
    </div>
    ${suite.tests.map(t => `
    <div class="test ${t.status}">
      <span class="test-name">
        ${t.status === 'passed' ? '✓' : t.status === 'failed' ? '✗' : '-'} ${escHtml(t.name)}
      </span>
      <span class="test-dur">${t.duration}ms</span>
    </div>
    ${t.status === 'failed' && t.error ? `<div class="error">${escHtml(t.error.message)}${t.error.stack ? '\n' + escHtml(t.error.stack) : ''}</div>` : ''}
    `).join('')}
  </div>
  `).join('')}

  <div class="timestamp">Generated: ${new Date().toISOString()}</div>
</body>
</html>`;

  const path = outputPath || resolve('test-framework/qtest-report.html');
  await writeFile(path, html, 'utf-8');
  return path;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============ CLI entry (re-exported for cli.ts) ============

export { run as runTest };
