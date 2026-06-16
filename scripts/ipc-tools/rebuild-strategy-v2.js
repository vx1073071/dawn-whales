/**
 * 精确重建 strategy-ipc.ts
 * 只提取 strategy/live/paper/nl domain 的 handler
 */
const fs = require('fs');

const src = fs.readFileSync('electron/main.bak.ts', 'utf8').split('\n');

// 收集所有 ipcMain.handle 行
const allHandlers = [];
for (let i = 0; i < src.length; i++) {
  if (src[i].includes('ipcMain.handle(')) {
    const m = src[i].match(/ipcMain\.handle\(['"]([^'"]+)['"]/);
    if (!m) continue;
    allHandlers.push({ chan: m[1], line: i });
  }
}

// 筛选 strategy domain
const DOMAINS = ['strategy', 'live', 'paper', 'nl'];
const targetHandlers = allHandlers.filter(h => DOMAINS.includes(h.chan.split(':')[0]));

console.log(`Found ${targetHandlers.length} strategy-domain handlers`);

// 提取每个 handler 块：从注释开始到下一个 handler 前
const blocks = [];
for (let idx = 0; idx < targetHandlers.length; idx++) {
  const h = targetHandlers[idx];
  
  // 向前回溯注释
  let blockStart = h.line;
  for (let b = 1; b <= 5; b++) {
    const prev = src[h.line - b];
    if (prev && (prev.trim().startsWith('//') || prev.trim() === '')) {
      blockStart = h.line - b;
    } else break;
  }
  
  // 结束：下一个 handler 的前一行（无论是否是 target domain）
  let blockEnd;
  const nextHandlerIdx = allHandlers.findIndex(ah => ah.line > h.line);
  if (nextHandlerIdx >= 0) {
    blockEnd = allHandlers[nextHandlerIdx].line - 1;
  } else {
    // 最后：找 }); 闭合
    blockEnd = h.line + 50;
    for (let i = h.line; i < src.length; i++) {
      if (src[i].includes('});') && i > h.line + 2) {
        blockEnd = i;
        break;
      }
    }
  }
  
  const blockLines = src.slice(blockStart, blockEnd + 1);
  blocks.push({ chan: h.chan, lines: blockLines });
}

// 构建输出
const out = [];
out.push('// ── QUANT MOO IPC: strategy ────────────────────────────────────────────');
out.push(`// ${blocks.length} handlers — strategy/live/paper/nl domains`);
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

for (const b of blocks) {
  out.push('');
  for (const l of b.lines) out.push(l);
}

out.push('');
out.push('}');

const final = out.join('\n') + '\n';
fs.writeFileSync('electron/ipc/strategy-ipc.ts', final, 'utf8');

// 验证 braces
let o = 0, cl = 0;
for (const ch of final) { if (ch === '{') o++; if (ch === '}') cl++; }
console.log(`Braces: ${o} / ${cl} (diff: ${o - cl})`);
console.log(`Lines: ${out.length}`);
