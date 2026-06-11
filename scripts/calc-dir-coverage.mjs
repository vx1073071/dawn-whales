import fs from 'fs';
import path from 'path';

const covFile = 'C:\\Users\\vx107\\lobsterai\\project\\r95-cov-final.txt';
const content = fs.readFileSync(covFile, 'utf-8').replace(/\x1b\[[0-9;]*m/g, '');
const lines = content.split('\n');

let currentDir = '';
const riskFiles = [];
const coreFiles = [];

for (const line of lines) {
  const t = line.trim();
  if (t.match(/^\s*engine\/risk\b/)) currentDir = 'risk';
  else if (t.match(/^\s*engine\/core\b/)) currentDir = 'core';
  else if (t.match(/^\s*engine\/(factor|portfolio|analysis|data|agents|backtest|utils)\b/)) currentDir = '';

  if ((currentDir === 'risk' || currentDir === 'core') && t.match(/\.ts\s+\|/)) {
    const m = t.match(/(\S+)\s+\|\s+([\d.]+)\s+\|/);
    if (m) {
      const name = m[1].replace('...', '');
      const pct = parseFloat(m[2]);
      const fp = path.join('electron', 'engine', currentDir, name);
      let fileLines = 0;
      try { fileLines = fs.readFileSync(fp, 'utf-8').split('\n').length; } catch {}
      const entry = { name, pct, lines: fileLines };
      if (currentDir === 'risk') riskFiles.push(entry);
      else coreFiles.push(entry);
    }
  }
}

function calcWeighted(files) {
  const totalLines = files.reduce((s, f) => s + f.lines, 0);
  const coveredLines = files.reduce((s, f) => s + (f.lines * f.pct / 100), 0);
  return { totalLines, coveredLines: Math.round(coveredLines), pct: totalLines ? (coveredLines / totalLines * 100).toFixed(2) : '0' };
}

const riskStats = calcWeighted(riskFiles);
const coreStats = calcWeighted(coreFiles);

console.log(`\n=== Risk Directory ===`);
console.log(`Files: ${riskFiles.length}, Lines: ${riskStats.totalLines}, Covered: ${riskStats.coveredLines}, Coverage: ${riskStats.pct}%`);
console.log(`Target: 50%, Gap: ${(50 - parseFloat(riskStats.pct)).toFixed(1)}%`);
console.log(`0% files:`);
riskFiles.filter(f => f.pct === 0).sort((a, b) => b.lines - a.lines).slice(0, 10).forEach(f => console.log(`  ${f.name}: ${f.lines}L`));
console.log(`Low (<50%):`);
riskFiles.filter(f => f.pct > 0 && f.pct < 50).sort((a, b) => b.lines - a.lines).forEach(f => console.log(`  ${f.name}: ${f.lines}L (${f.pct}%)`));

console.log(`\n=== Core Directory ===`);
console.log(`Files: ${coreFiles.length}, Lines: ${coreStats.totalLines}, Covered: ${coreStats.coveredLines}, Coverage: ${coreStats.pct}%`);
console.log(`Target: 65%, Gap: ${(65 - parseFloat(coreStats.pct)).toFixed(1)}%`);
console.log(`0% files:`);
coreFiles.filter(f => f.pct === 0).sort((a, b) => b.lines - a.lines).slice(0, 10).forEach(f => console.log(`  ${f.name}: ${f.lines}L`));
console.log(`Low (<50%):`);
coreFiles.filter(f => f.pct > 0 && f.pct < 50).sort((a, b) => b.lines - a.lines).forEach(f => console.log(`  ${f.name}: ${f.lines}L (${f.pct}%)`));
