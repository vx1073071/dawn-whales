#!/usr/bin/env node
// tests/test-dashboard.ts
// Generate HTML test report from test results
// Run: npx tsx tests/test-dashboard.ts [test-results-dir]

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  title: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface SuiteResult {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

interface CoverageResult {
  total: number;
  covered: number;
  pct: number;
  files: Record<string, { total: number; covered: number; pct: number }>;
}

// ── Default paths ───────────────────────────────────────────────
const resultsDir = process.argv[2] || 'coverage';
const lcovPath = path.join(resultsDir, 'lcov.info');

function readJSON<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as T; }
  catch { return null; }
}

// ── Parse lcov for per-file coverage ────────────────────────────
function parseLcov(lcovPath: string): Record<string, { total: number; covered: number; pct: number }> {
  const files: Record<string, { total: number; covered: number; pct: number }> = {};
  try {
    const lines = fs.readFileSync(lcovPath, 'utf-8').replace(/\r\n/g, '\n').split('\n');
    let currentFile = '';
    let hitLines = new Set<number>();
    let allLines = new Set<number>();

    for (const L of lines) {
      if (L.startsWith('SF:')) {
        if (currentFile) {
          files[currentFile] = {
            total: allLines.size,
            covered: hitLines.size,
            pct: allLines.size > 0 ? Math.round((hitLines.size / allLines.size) * 100) : 0,
          };
        }
        currentFile = L.slice(3);
        hitLines = new Set();
        allLines = new Set();
      } else if (L.startsWith('DA:')) {
        const parts = L.slice(3).split(',');
        const line = parseInt(parts[0]);
        const hits = parseInt(parts[1] || '0');
        allLines.add(line);
        if (hits > 0) hitLines.add(line);
      }
    }
    if (currentFile) {
      files[currentFile] = {
        total: allLines.size,
        covered: hitLines.size,
        pct: allLines.size > 0 ? Math.round((hitLines.size / allLines.size) * 100) : 0,
      };
    }
  } catch { /* no lcov */ }
  return files;
}

// ── Summary data ────────────────────────────────────────────────
const lcovFiles = fs.existsSync(lcovPath) ? parseLcov(lcovPath) : {};

// Compute totals from lcov data
let totalCovered = 0;
let totalLines = 0;
for (const f of Object.values(lcovFiles)) {
  totalCovered += f.covered;
  totalLines += f.total;
}
const pct = totalLines > 0 ? Math.round((totalCovered / totalLines) * 100) : 0;
const covered = totalCovered;
const total = totalLines;

// Top uncovered files
const uncovered = Object.entries(lcovFiles)
  .filter(([, v]) => v.pct < 80)
  .sort((a, b) => a[1].pct - b[1].pct)
  .slice(0, 10)
  .map(([f, v]) => ({ file: path.basename(f), pct: v.pct, covered: v.covered, total: v.total }));

// ── HTML Report ──────────────────────────────────────────────────
const barColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444';
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Report — DAWN WHALES</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e2e8f0; min-height: 100vh; padding: 2rem; }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; color: #fff; }
  .subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: #111119; border: 1px solid #1e1e2e; border-radius: 12px; padding: 1.25rem; }
  .card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem; }
  .card-value { font-size: 2rem; font-weight: 700; }
  .card-value.green { color: #22c55e; }
  .card-value.yellow { color: #eab308; }
  .card-value.red { color: #ef4444; }
  .card-sub { font-size: 0.75rem; color: #475569; margin-top: 0.25rem; }
  .section-title { font-size: 1.125rem; font-weight: 600; margin: 2rem 0 1rem; color: #fff; }
  table { width: 100%; border-collapse: collapse; background: #111119; border-radius: 12px; overflow: hidden; }
  th { text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #1e1e2e; }
  td { padding: 0.75rem 1rem; border-bottom: 1px solid #1e1e2e; font-size: 0.875rem; }
  tr:last-child td { border-bottom: none; }
  .pct-bar { display: flex; align-items: center; gap: 0.5rem; }
  .bar-bg { flex: 1; height: 6px; background: #1e1e2e; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
  .pct-label { font-size: 0.75rem; color: #94a3b8; min-width: 3rem; text-align: right; }
  .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .badge.green { background: rgba(34,197,94,0.15); color: #22c55e; }
  .badge.red { background: rgba(239,68,68,0.15); color: #ef4444; }
  .badge.yellow { background: rgba(234,179,8,0.15); color: #eab308; }
  .timestamp { color: #475569; font-size: 0.75rem; margin-top: 2rem; }
  .nav { display: flex; gap: 1rem; margin-bottom: 2rem; }
  .nav a { color: #64748b; text-decoration: none; font-size: 0.875rem; padding: 0.5rem 1rem; border-radius: 6px; transition: background 0.2s; }
  .nav a:hover { background: #111119; color: #e2e8f0; }
  .nav a.active { background: #1e1e2e; color: #fff; }
</style>
</head>
<body>
<div class="container">
  <div class="nav">
    <a href="#" class="active">Summary</a>
    <a href="#coverage">Coverage</a>
    <a href="#uncovered">Uncovered Files</a>
  </div>

  <h1>DAWN WHALES — Test Report</h1>
  <p class="subtitle">Automated test &amp; coverage dashboard</p>

  <div class="grid">
    <div class="card">
      <div class="card-label">Coverage</div>
      <div class="card-value ${pct >= 80 ? 'green' : pct >= 60 ? 'yellow' : 'red'}">${pct}%</div>
      <div class="card-sub">${covered} / ${total} lines</div>
    </div>
    <div class="card">
      <div class="card-label">Status</div>
      <div class="card-value ${pct >= 80 ? 'green' : 'yellow'}">${pct >= 80 ? 'PASS' : pct >= 60 ? 'WARN' : 'FAIL'}</div>
      <div class="card-sub">${pct >= 80 ? 'All systems go' : 'Needs improvement'}</div>
    </div>
    <div class="card">
      <div class="card-label">Files Analyzed</div>
      <div class="card-value">${Object.keys(lcovFiles).length}</div>
      <div class="card-sub">engine/**/*.ts</div>
    </div>
    <div class="card">
      <div class="card-label">Report Generated</div>
      <div class="card-value" style="font-size:1rem">${new Date().toLocaleString()}</div>
      <div class="card-sub">DAWN WHALES v0.7.0</div>
    </div>
  </div>

  <div class="section-title" id="coverage">Coverage by File</div>
  <table>
    <thead>
      <tr>
        <th>File</th>
        <th style="width:300px">Coverage</th>
        <th>Lines</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(lcovFiles)
        .filter(([, v]) => v.total > 0)
        .sort((a, b) => b[1].pct - a[1].pct)
        .slice(0, 20)
        .map(([f, v]) => {
          const c = v.pct >= 80 ? 'green' : v.pct >= 60 ? 'yellow' : 'red';
          return `<tr>
            <td><code style="font-size:0.8rem;color:#94a3b8">${path.basename(f)}</code></td>
            <td>
              <div class="pct-bar">
                <div class="bar-bg"><div class="bar-fill" style="width:${v.pct}%;background:${barColor}"></div></div>
                <span class="pct-label">${v.pct}%</span>
              </div>
            </td>
            <td style="color:#64748b">${v.covered} / ${v.total}</td>
            <td><span class="badge ${c}">${v.pct >= 80 ? '✓ Good' : v.pct >= 60 ? '⚠ Fair' : '✗ Low'}</span></td>
          </tr>`;
        }).join('\n')}
    </tbody>
  </table>

  ${uncovered.length > 0 ? `
  <div class="section-title" id="uncovered">⚠ Files Below 80% Coverage</div>
  <table>
    <thead><tr><th>File</th><th>Coverage</th><th>Lines</th></tr></thead>
    <tbody>
      ${uncovered.map(f => `<tr>
        <td><code style="font-size:0.8rem;color:#ef4444">${f.file}</code></td>
        <td><span class="badge red">${f.pct}%</span></td>
        <td style="color:#64748b">${f.covered} / ${f.total}</td>
      </tr>`).join('\n')}
    </tbody>
  </table>` : ''}

  <p class="timestamp">Generated by DAWN WHALES test-dashboard.ts</p>
</div>
</body>
</html>`;

// ── Write report ─────────────────────────────────────────────────
const outPath = path.join(resultsDir, 'test-dashboard.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log(`Report written to: ${outPath}`);
console.log(`Coverage: ${pct}% (${covered}/${total} lines)`);
