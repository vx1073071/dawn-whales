/**
 * 最终修复: 从main.bak.ts用Node精确提取handler块 (保持正确的UTF-8编码)
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('electron/main.bak.ts', 'utf8');
const srcLines = src.split('\n');

// 找到每个 ipcMain.handle 的起始行
const handleStarts = [];
for (let i = 0; i < srcLines.length; i++) {
  if (srcLines[i].includes('ipcMain.handle(')) {
    handleStarts.push(i);
  }
}

// 提取每个handler块
const handlers = [];
for (let idx = 0; idx < handleStarts.length; idx++) {
  const start = handleStarts[idx];
  // 向前回溯注释 (最多5行)
  let blockStart = start;
  for (let b = 1; b <= 5; b++) {
    const prev = srcLines[start - b];
    if (prev && (prev.trim().startsWith('//') || prev.trim() === '')) {
      blockStart = start - b;
    } else {
      break;
    }
  }
  
  // 结束: 下一个handler的前一行
  let blockEnd;
  if (idx < handleStarts.length - 1) {
    blockEnd = handleStarts[idx + 1] - 1;
  } else {
    blockEnd = srcLines.length - 1;
  }
  
  const chan = srcLines[start].match(/ipcMain\.handle\(['"]([^'"]+)['"]/)?.[1] || '?';
  const dom = chan.split(':')[0];
  
  handlers.push({ chan, dom, start: blockStart, end: blockEnd });
}

// Domain合并
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

// 服务引用分析
const REFS = ['opendClient','brokerManager','strategyEngine','backtestEngine','riskEngine',
  'liveExecutor','marketplaceService','dataProvider','emDataProvider','macroDataProvider',
  'stockScreener','newsAggregator','sectorRotation','stockAnomalyDetector','marketHotspot',
  'dataScheduler','db','WATCHLIST','mainWindow','getDeepSeekKey_','quotePushHandler',
  'calcGreeksJS','app','autoUpdater','orderRouter','tcaEngine','multiBrokerPnL',
  'sentimentAttrEngine','flowPredictor','unifiedRiskDash',
  'STRATEGY_UPDATE_WHITELIST','smartCacheManager','signalQualityScorer','positionAlertEngine',
  'shell','BrokerConfig'];

function findRefs(lines) {
  const body = lines.join('\n');
  const refs = new Set();
  for (const r of REFS) {
    const re = new RegExp(`(?<!\\.)\\b${r}\\b`);
    if (re.test(body)) refs.add(r === 'WATCHLIST' ? 'watchlist' : r);
  }
  return [...refs];
}

const ipcDir = path.join('electron', 'ipc');
let written = 0;

for (const [modName, hList] of Object.entries(groups)) {
  const allRefs = new Set();
  const out = [];
  
  out.push(`// ── DAWN WHALES IPC: ${modName} ────────────────────────────────────────────`);
  out.push(`// ${hList.length} handlers`);
  out.push('');
  out.push(`import { ipcMain, BrowserWindow, app, shell } from 'electron';`);
  out.push(`import { autoUpdater } from 'electron-updater';`);
  out.push(`import log from 'electron-log';`);
  out.push(`import { validate } from '../ipc-schemas';`);
  out.push('');
  
  // 分析所有handler需要的额外imports
  for (const h of hList) {
    const block = srcLines.slice(h.start, h.end + 1);
    findRefs(block).forEach(r => allRefs.add(r));
  }
  
  const params = [...allRefs].filter(r => r && r !== 'undefined' && r !== 'shell' && r !== 'app' && r !== 'autoUpdater');
  
  out.push(`export function register${toPascal(modName)}IPC(`);
  if (params.length > 0) {
    out.push('  ' + params.map(p => `${p}: any`).join(',\n  '));
  }
  out.push(`) {`);
  
  // 输出每个handler块
  for (const h of hList) {
    out.push('');
    for (let i = h.start; i <= h.end; i++) {
      out.push(srcLines[i]);
    }
  }
  
  out.push('');
  out.push('}');
  
  // 用 Node writeFile 确保正确UTF-8编码
  const filePath = path.join(ipcDir, `${modName}-ipc.ts`);
  fs.writeFileSync(filePath, out.join('\n') + '\n', 'utf8');
  written++;
}

console.log(`✅ ${written} IPC modules written (UTF-8 safe)`);
console.log(`Handlers: ${handlers.length}`);
