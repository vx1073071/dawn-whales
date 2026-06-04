/**
 * 最终修复: 从 main.bak.ts 精确提取 handler 块, 用 "下一个ipcMain.handle" 作为边界
 * 而不是花括号计数 (会被模板字符串干扰)
 */
const fs = require('fs');
const path = require('path');

const srcLines = fs.readFileSync('electron/main.bak.ts', 'utf8').split('\n');

// 找到所有 ipcMain.handle 的精确行号
const handleStarts = [];
for (let i = 0; i < srcLines.length; i++) {
  if (srcLines[i].match(/^\s*ipcMain\.handle\(/)) {
    handleStarts.push(i);
  }
}

// 为每个handler提取从 (start-注释行) 到 (下一个handle开始前) 的代码
// 注意: 需要处理 setupIPC 函数内的handler
const handlers = [];
for (let idx = 0; idx < handleStarts.length; idx++) {
  const startLine = handleStarts[idx];
  // 向前查找注释 (最多回溯3行)
  let blockStart = startLine;
  for (let b = 1; b <= 3; b++) {
    const prev = srcLines[startLine - b];
    if (prev && (prev.trim().startsWith('//') || prev.trim() === '')) {
      blockStart = startLine - b;
    } else {
      break;
    }
  }
  
  // 结束行: 下一个 ipcMain.handle 行前一行
  let blockEnd;
  if (idx < handleStarts.length - 1) {
    blockEnd = handleStarts[idx + 1] - 1;
  } else {
    // 最后一个handler: 找到下一个空行后的 function 或顶层结构
    blockEnd = startLine + 100; // conservative
    for (let i = startLine; i < srcLines.length; i++) {
      if (srcLines[i].trim().startsWith('function ') && i > startLine + 5) {
        blockEnd = i - 1;
        break;
      }
    }
  }
  
  // 向后找闭合的 }); (在函数作用域内)
  // 但不用花括号计数，而是找下一个顶层 ipcMain.handle 或 function
  const chan = srcLines[startLine].match(/ipcMain\.handle\(['"]([^'"]+)['"]/)?.[1] || '?';
  const dom = chan.split(':')[0];
  
  const blockLines = srcLines.slice(blockStart, blockEnd + 1);
  
  handlers.push({
    chan,
    dom,
    start: blockStart,
    end: blockEnd,
    lines: blockLines,
    hasTemplate: blockLines.join('\n').includes('`'),
  });
}

console.log(`Total handlers extracted: ${handlers.length}`);
console.log(`With templates: ${handlers.filter(h => h.hasTemplate).length}`);

// 检查有无重叠
let overlaps = 0;
for (let i = 1; i < handlers.length; i++) {
  if (handlers[i].start <= handlers[i-1].end) {
    overlaps++;
  }
}
console.log(`Overlapping blocks: ${overlaps}`);

// 输出有模板字符串的handler的块大小
for (const h of handlers.filter(h => h.hasTemplate)) {
  console.log(`  ${h.chan}: L${h.start+1}-L${h.end+1} (${h.lines.length} lines)`);
}

// 重新生成IPC模块
const DOMAIN_MERGE = {
  alert: 'alert-notification', notification: 'alert-notification',
  order: 'broker', trader: 'broker', signal: 'broker', position: 'broker',
  execution: 'broker', pnl: 'broker', predict: 'data', anomaly: 'data',
  regime: 'data', factor: 'data', screener: 'data',
  greeks: 'options', quote: 'ws', push2: 'ws', 'rate-limiter': 'data',
  nl: 'strategy', live: 'strategy', paper: 'strategy',
};

const groups = {};
for (const h of handlers) {
  const dom = DOMAIN_MERGE[h.dom] || h.dom;
  if (!groups[dom]) groups[dom] = [];
  groups[dom].push(h);
}

function toPascal(str) {
  return str.split(/[-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

const ipcDir = path.join('electron', 'ipc');
const REF_PATTERNS = {
  opendClient: true, brokerManager: true, strategyEngine: true, backtestEngine: true,
  riskEngine: true, liveExecutor: true, marketplaceService: true, dataProvider: true,
  emDataProvider: true, macroDataProvider: true, stockScreener: true, newsAggregator: true,
  sectorRotation: true, stockAnomalyDetector: true, marketHotspot: true, dataScheduler: true,
  db: true, WATCHLIST: 'watchlist', mainWindow: true, getDeepSeekKey_: true,
  quotePushHandler: true, calcGreeksJS: true, app: true, autoUpdater: true,
};

const NAME_MAP = { WATCHLIST: 'watchlist' };

function findRefs(blockLines) {
  const body = blockLines.join('\n');
  const refs = new Set();
  for (const [name, mapped] of Object.entries(REF_PATTERNS)) {
    const re = new RegExp(`(?<!\\.)\\b${name}\\b`);
    if (re.test(body)) {
      refs.add(typeof mapped === 'string' ? mapped : name);
    }
  }
  // also check for variables created in setupIPC
  for (const v of ['orderRouter','tcaEngine','multiBrokerPnL','sentimentAttrEngine',
    'flowPredictor','unifiedRiskDash','signalQualityScorer','positionAlertEngine',
    'STRATEGY_UPDATE_WHITELIST','BrokerConfig','smartCacheManager']) {
    const re = new RegExp(`\\b${v}\\b`);
    if (re.test(body)) refs.add(v);
  }
  return [...refs];
}

let fixedCount = 0;

for (const [modName, handlerList] of Object.entries(groups)) {
  const allRefs = new Set();
  for (const h of handlerList) {
    findRefs(h.lines).forEach(r => allRefs.add(r));
  }
  
  const out = [];
  out.push(`// ── DAWN WHALES IPC: ${modName} ────────────────────────────────────────────`);
  out.push(`// ${handlerList.length} handlers — auto-extracted from main.bak.ts`);
  out.push(``);
  out.push(`import { ipcMain, BrowserWindow, app, shell } from 'electron';`);
  out.push(`import { autoUpdater } from 'electron-updater';`);
  out.push(`import log from 'electron-log';`);
  out.push(``);
  out.push(`export function register${toPascal(modName)}IPC(`);
  
  const params = [...allRefs].filter(r => r && r !== 'undefined');
  if (params.length > 0) {
    out.push('  ' + params.map(p => `${p}: any`).join(',\n  '));
  }
  out.push(`) {`);
  
  for (const h of handlerList) {
    out.push(``);
    // handler代码保持原样缩进 (已经是2空格)
    for (const l of h.lines) {
      out.push(l);
    }
  }
  
  out.push(``);
  out.push(`}`);
  
  const filePath = path.join(ipcDir, `${modName}-ipc.ts`);
  fs.writeFileSync(filePath, out.join('\n'), 'utf8');
  fixedCount++;
}

console.log(`\n✅ ${fixedCount} IPC modules regenerated`);
console.log(`Total handlers: ${handlers.length}`);
