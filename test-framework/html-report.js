/**
 * QTest HTML Report Generator
 * Q45: 可视化测试报告
 */

import { writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateHtml(result, { title = 'QTest Report', theme = 'dark' } = {}) {
  const { suites, totalTests, passed, failed, skipped, todo, duration } = result;
  const passPct = totalTests > 0 ? Math.round(passed / totalTests * 100) : 0;
  const failPct = totalTests > 0 ? Math.round(failed / totalTests * 100) : 0;
  const skipPct = totalTests > 0 ? Math.round((skipped + todo) / totalTests * 100) : 0;

  // Collect per-file stats
  const fileStats = {};
  for (const s of suites) {
    const f = s.file || '(unknown)';
    if (!fileStats[f]) fileStats[f] = { passed: 0, failed: 0, skipped: 0, todo: 0, duration: 0, tests: [] };
    for (const t of s.tests) {
      if (t.status === 'passed') fileStats[f].passed++;
      else if (t.status === 'failed') fileStats[f].failed++;
      else if (t.status === 'skipped') { if (t.todo) fileStats[f].todo++; else fileStats[f].skipped++; }
      fileStats[f].duration += t.duration || 0;
      fileStats[f].tests.push(t);
    }
  }

  const files = Object.keys(fileStats);

  // Duration histogram
  const durations = suites.flatMap(s => s.tests.map(t => t.duration || 0));
  const maxDur = Math.max(...durations, 1);
  const bucketCount = 10;
  const histo = new Array(bucketCount).fill(0);
  for (const d of durations) {
    const idx = Math.min(Math.floor(d / maxDur * bucketCount), bucketCount - 1);
    histo[idx]++;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #c9d1d9; padding: 2rem; }
    h1 { color: #58a6ff; font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #8b949e; font-size: 0.85rem; margin-bottom: 2rem; }
    .cards { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.5rem; min-width: 130px; }
    .card .label { color: #8b949e; font-size: 0.8rem; }
    .card .value { font-size: 2rem; font-weight: 700; }
    .card.total .value { color: #58a6ff; }
    .card.pass .value { color: #3fb950; }
    .card.fail .value { color: #f85149; }
    .card.skip .value { color: #8b949e; }
    .card.dur .value { color: #d29922; font-size: 1.4rem; }
    .progress-wrap { margin-bottom: 2rem; }
    .progress-bar { height: 8px; border-radius: 4px; background: #21262d; overflow: hidden; display: flex; }
    .progress-bar .pass { background: #3fb950; }
    .progress-bar .fail { background: #f85149; }
    .progress-bar .skip { background: #8b949e; }
    .progress-labels { display: flex; gap: 1.5rem; margin-top: 0.5rem; font-size: 0.8rem; color: #8b949e; }
    .progress-labels span span { font-weight: 600; }
    .charts { display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .chart-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; flex: 1; min-width: 300px; }
    .chart-title { color: #8b949e; font-size: 0.8rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    canvas { width: 100% !important; height: 200px !important; }
    .file-section { margin-bottom: 2rem; }
    .file-header { background: #1c2128; border: 1px solid #30363d; border-radius: 8px 8px 0 0; padding: 0.75rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; }
    .file-header:hover { background: #1a1f2; }
    .file-header.open { border-radius: 8px 8px 0 0; }
    .file-name { font-weight: 600; font-size: 0.9rem; }
    .file-meta { font-size: 0.8rem; color: #8b949e; }
    .file-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
    .badge-pass { background: rgba(63,185,80,0.15); color: #3fb950; }
    .badge-fail { background: rgba(248,81,73,0.15); color: #f85149; }
    .badge-skip { background: rgba(139,148,158,0.15); color: #8b949e; }
    .test-list { background: #161b22; border: 1px solid #30363d; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; display: none; }
    .file-section.open .test-list { display: block; }
    .test-row { padding: 0.5rem 1rem; border-top: 1px solid #21262d; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; }
    .test-row:hover { background: #1a1f2; }
    .test-row.pass { border-left: 3px solid #3fb950; }
    .test-row.fail { border-left: 3px solid #f85149; background: rgba(248,81,73,0.05); }
    .test-row.skip { border-left: 3px solid #8b949e; opacity: 0.6; }
    .test-name { font-family: 'Cascadia Code', 'Fira Code', monospace; }
    .test-dur { color: #8b949e; font-size: 0.75rem; white-space: nowrap; margin-left: 1rem; }
    .error-msg { padding: 0.5rem 1rem; background: rgba(248,81,73,0.1); color: #f85149; font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; border-top: 1px solid #21262d; display: none; }
    .test-row.open + .error-msg { display: block; }
    @media (max-width: 600px) { body { padding: 1rem; } .cards { flex-direction: column; } }
  </style>
</head>
<body>
  <h1>QTest Report</h1>
  <div class="subtitle">Generated: ${new Date().toISOString()} &middot; Duration: ${(duration / 1000).toFixed(2)}s</div>

  <div class="cards">
    <div class="card total"><div class="label">Total</div><div class="value">${totalTests}</div></div>
    <div class="card pass"><div class="label">Passed</div><div class="value">${passed}</div></div>
    <div class="card fail"><div class="label">Failed</div><div class="value">${failed}</div></div>
    <div class="card skip"><div class="label">Skipped</div><div class="value">${skipped + todo}</div></div>
    <div class="card dur"><div class="label">Duration</div><div class="value">${(duration / 1000).toFixed(2)}s</div></div>
  </div>

  <div class="progress-wrap">
    <div class="progress-bar">
      <div class="pass" style="width: ${passPct}%"></div>
      <div class="fail" style="width: ${failPct}%"></div>
      <div class="skip" style="width: ${skipPct}%"></div>
    </div>
    <div class="progress-labels">
      <span>Passed: <span>${passPct}%</span></span>
      <span>Failed: <span>${failPct}%</span></span>
      <span>Skipped/Todo: <span>${skipPct}%</span></span>
    </div>
  </div>

  <div class="charts">
    <div class="chart-card">
      <div class="chart-title">Test Duration Histogram</div>
      <canvas id="dur-chart"></canvas>
    </div>
    <div class="chart-card">
      <div class="chart-title">Per-File Pass/Fail Breakdown</div>
      <canvas id="file-chart"></canvas>
    </div>
  </div>

  ${files.map(f => {
    const s = fileStats[f];
    return `
  <div class="file-section" id="file-${escHtml(f).replace(/[^a-zA-Z0-9]/g, '-')}">
    <div class="file-header" onclick="toggleFile(this)">
      <div>
        <span class="file-name">${escHtml(f)}</span>
        <span class="file-badge ${s.failed > 0 ? 'badge-fail' : 'badge-pass'}">${s.passed}/${s.passed + s.failed + s.skipped + s.todo}</span>
        <span class="file-meta">${(s.duration / 1000).toFixed(2)}s</span>
      </div>
      <span class="file-meta">${s.passed} passed &middot; ${s.failed} failed &middot; ${s.skipped + s.todo} skipped</span>
    </div>
    <div class="test-list">
      ${s.tests.map((t, i) => `
        <div class="test-row ${t.status}" id="test-${escHtml(f)}-${i}" onclick="toggleError(this)">
          <span class="test-name">${t.status === 'passed' ? '&#10003;' : t.status === 'failed' ? '&#10007;' : '-'} ${escHtml(t.name)}</span>
          <span class="test-dur">${t.duration}ms</span>
        </div>
        ${t.status === 'failed' && t.error ? `<div class="error-msg">${escHtml(t.error.message || String(t.error))}${t.error.stack ? '\n' + escHtml(t.error.stack) : ''}</div>` : ''}
      `).join('')}
    </div>
  </div>`;
  }).join('')}

  <script>
    /* Toggle file section */
    function toggleFile(header) {
      const section = header.parentElement;
      section.classList.toggle('open');
    }

    /* Toggle error message */
    function toggleError(row) {
      row.classList.toggle('open');
    }

    /* Chart: Duration Histogram */
    (function() {
      const canvas = document.getElementById('dur-chart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = 200 * dpr;
      ctx.scale(dpr, dpr);

      const data = ${JSON.stringify(histo)};
      const max = Math.max(...data, 1);
      const colors = ['#58a6ff', '#3fb950', '#f85149', '#d29922', '#8b949e'];
      const w = canvas.offsetWidth / data.length;
      const pad = 4;
      data.forEach((v, i) => {
        const h = (v / max) * 180;
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(i * w + pad, 200 - h, w - pad * 2, h);
      });
    })();

    /* Chart: Per-file breakdown */
    (function() {
      const canvas = document.getElementById('file-chart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = 200 * dpr;
      ctx.scale(dpr, dpr);

      const files = ${JSON.stringify(files)};
      const stats = ${JSON.stringify(files.map(f => [fileStats[f].passed, fileStats[f].failed, fileStats[f].skipped + fileStats[f].todo]))};
      const cw = canvas.offsetWidth;
      const ch = 200;
      const barW = Math.min(60, (cw / Math.max(files.length, 1)) * 0.7);
      const gap = (cw - barW * Math.max(files.length, 1)) / (Math.max(files.length, 1) + 1);

      const maxV = Math.max(...stats.flat(), 1);
      const scale = (ch - 30) / maxV;

      /* y-axis */
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = 10 + (ch - 30) * (1 - i / 5);
        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxV * i / 5), 28, y + 3);
        ctx.beginPath();
        ctx.strokeStyle = '#21262d';
        ctx.moveTo(30, y);
        ctx.lineTo(cw - 10, y);
        ctx.stroke();
      }

      stats.forEach((s, i) => {
        const x = gap + i * (barW + gap);
        let y = ch - 20;
        ctx.fillStyle = '#3fb950';
        const h0 = s[0] * scale;
        ctx.fillRect(x, y - h0, barW / 3, h0);
        y -= h0;
        ctx.fillStyle = '#f85149';
        const h1 = s[1] * scale;
        ctx.fillRect(x + barW / 3, y - h1, barW / 3, h1);
        y -= h1;
        ctx.fillStyle = '#8b949e';
        const h2 = s[2] * scale;
        ctx.fillRect(x + 2 * barW / 3, y - h2, barW / 3, h2);
      });
    })();
  </script>
</body>
</html>`;

  return html;
}

export async function generateHtmlReport(result, outputPath) {
  const html = generateHtml(result);
  const path = outputPath || resolve('qtest-dashboard.html');
  await writeFile(path, html, 'utf-8');
  return path;
}

export default { generateHtml, generateHtmlReport };
