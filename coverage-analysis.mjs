import { readFileSync } from 'fs';
const j = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));

// 按 electron/ 子目录聚合 (3级)
const subDirs = {};
for (const [file, data] of Object.entries(j)) {
  if (file === 'total') continue;
  const rel = file.replace(/.*dawn-whales[\/\\]/, '').replace(/\\/g, '/');
  const parts = rel.split('/');
  // electron/engine/core -> electron/engine/core
  // electron/main/main.ts -> electron/main
  const dir = parts.length >= 3 ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
  if (!subDirs[dir]) subDirs[dir] = { total: 0, covered: 0 };
  subDirs[dir].total += data.lines.total;
  subDirs[dir].covered += data.lines.covered;
}
const rows = Object.entries(subDirs)
  .map(([d, v]) => ({ dir: d, total: v.total, cov: v.covered, uncov: v.total - v.covered, pct: v.total ? Math.round(v.covered / v.total * 1000) / 10 : 0 }))
  .sort((a, b) => b.uncov - a.uncov);
console.log('=== electron/ 子目录覆盖率 (按缺口排序 Top 30) ===');
console.table(rows.slice(0, 30));

console.log('\n总行数:', j.total.lines.total, '  已覆盖:', j.total.lines.covered, '  覆盖率:', j.total.lines.pct + '%');
console.log('达到65%还需额外覆盖:', Math.round(j.total.lines.total * 0.65) - j.total.lines.covered, '行');

// 找零覆盖大文件
console.log('\n=== 零覆盖率大文件 (>100行且0%覆盖) ===');
const zeroCov = [];
for (const [file, data] of Object.entries(j)) {
  if (file === 'total') continue;
  if (data.lines.total > 100 && data.lines.covered === 0) {
    zeroCov.push({ file: file.replace(/.*dawn-whales[\/\\]/, ''), lines: data.lines.total });
  }
}
zeroCov.sort((a, b) => b.lines - a.lines);
console.table(zeroCov.slice(0, 30));
console.log('零覆盖大文件总行数:', zeroCov.reduce((s, v) => s + v.lines, 0));
