const fs = require('fs');
const src = fs.readFileSync('electron/main.bak.ts', 'utf8');
const lines = src.split('\n');

// Find first strategy handler
let firstStrat = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('strategy:create') && lines[i].includes('ipcMain.handle')) {
    firstStrat = i; break;
  }
}

// Find last handler in strategy domain
let lastLive = -1;
for (let i = lines.length - 1; i > 0; i--) {
  if (lines[i].includes('live:get-orders')) { lastLive = i; break; }
}

// Find live:get-orders closing
let liveOrdersEnd = lastLive;
for (let i = lastLive; i < lines.length; i++) {
  if (lines[i].includes('});') && i > lastLive + 1) { liveOrdersEnd = i; break; }
}

// Back up for leading comments
let blockStart = firstStrat;
for (let b = 1; b <= 5; b++) {
  const prev = lines[firstStrat - b];
  if (prev && prev.trim().startsWith('//')) blockStart = firstStrat - b;
  else break;
}

console.log('Block: L' + (blockStart+1) + ' to L' + (liveOrdersEnd+1));

const block = lines.slice(blockStart, liveOrdersEnd + 1);

const out = [];
out.push('// ── QUANT MOO IPC: strategy ────────────────────────────────────────────');
out.push('// ' + block.length + ' lines');
out.push('');
out.push('import { ipcMain, BrowserWindow, app } from "electron";');
out.push('import log from "electron-log";');
out.push('');
out.push('export function registerStrategyIPC(');
out.push('  strategyEngine: any,');
out.push('  db: any,');
out.push('  opendClient: any,');
out.push('  backtestEngine: any,');
out.push('  getDeepSeekKey_: any,');
out.push('  liveExecutor: any');
out.push(') {');
out.push('');
for (const l of block) out.push(l);
out.push('');
out.push('}');

const final = out.join('\n') + '\n';
fs.writeFileSync('electron/ipc/strategy-ipc.ts', final, 'utf8');

// Verify
let o = 0, cl = 0;
for (const ch of final) { if (ch === '{') o++; if (ch === '}') cl++; }
console.log('Braces: ' + o + ' / ' + cl + ' (diff: ' + (o-cl) + ')');
console.log('Lines: ' + out.length);
