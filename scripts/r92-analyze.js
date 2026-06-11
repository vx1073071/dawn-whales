// R92 youdao test analysis script
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

console.log('=== R92 youdao Analysis ===\n');

// 1. Count excludes in vitest.config.ts
const vitestConfig = fs.readFileSync(path.join(ROOT, 'vitest.config.ts'), 'utf-8');
const excludeMatch = vitestConfig.match(/exclude:\s*\[([\s\S]*?)\]/);
let excludeCount = 0;
let excludeList = [];
if (excludeMatch) {
  const excludeBlock = excludeMatch[1];
  const lines = excludeBlock.split('\n').filter(l => l.trim().startsWith("'") || l.trim().startsWith('"'));
  excludeList = lines.map(l => l.trim().replace(/['",]/g, '')).filter(l => l.length > 0);
  excludeCount = excludeList.length;
}
console.log(`[Q-01] vitest exclude count: ${excludeCount}`);
excludeList.forEach(f => console.log(`  - ${f}`));

// 2. Count test files
const testDir = path.join(ROOT, 'tests');
const allTestFiles = [];
function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full);
    else if (e.name.endsWith('.test.ts') || e.name.endsWith('.test.tsx')) allTestFiles.push(full);
  }
}
walkDir(testDir);
console.log(`\n[Q-01] Total test files on disk: ${allTestFiles.length}`);

// 3. Count engine files
const engineDir = path.join(ROOT, 'electron', 'engine');
let engineCount = 0;
if (fs.existsSync(engineDir)) {
  function countTs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) countTs(path.join(dir, e.name));
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) engineCount++;
    }
  }
  countTs(engineDir);
}
console.log(`[Q-01] Engine files: ${engineCount}`);

// 4. Check vitest node config for additional excludes
const nodeConfig = path.join(ROOT, 'vitest.node.config.ts');
let nodeExcludeCount = 0;
if (fs.existsSync(nodeConfig)) {
  const nc = fs.readFileSync(nodeConfig, 'utf-8');
  const nm = nc.match(/exclude:\s*\[([\s\S]*?)\]/);
  if (nm) {
    const lines = nm[1].split('\n').filter(l => l.trim().startsWith("'") || l.trim().startsWith('"'));
    nodeExcludeCount = lines.filter(l => l.trim().replace(/['",]/g, '').length > 0).length;
  }
}
console.log(`[Q-01] vitest.node.config.ts exclude count: ${nodeExcludeCount}`);

// 5. Summary
console.log(`\n=== SUMMARY ===`);
console.log(`Total excludes: ${excludeCount} (main) + ${nodeExcludeCount} (node) = ${excludeCount + nodeExcludeCount}`);
console.log(`Engine files: ${engineCount}`);
console.log(`Test files: ${allTestFiles.length}`);
console.log(`\nQ-01 target: fail=0, exclude=0`);
console.log(`Q-01 current: exclude=${excludeCount} (main) — NEEDS WORK`);
