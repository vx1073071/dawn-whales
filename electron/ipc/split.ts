/**
 * DAWN WHALES — main.ts 拆分脚本
 * 
 * 提取所有顶层 ipcMain.handle() 调用，按 domain 分组到 electron/ipc/ 下
 * main.ts 缩减为 ~400 行（imports + createWindow + services + registerAllIPC + app lifecycle）
 */

const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync('electron/main.ts', 'utf8').split('\n');

// ── Step 1: 找所有 ipcMain.handle 块（包括在setupIPC内和外的）
// ─────────────────────────────────────────────────────────────────────

function findMatchingBlock(lines, startIdx) {
  // 从 startIdx 行开始，找到对应的 }); 结束
  // 处理: ipcMain.handle('xxx', async (...) => { ... });
  let depth = 0;
  let inBlock = false;
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    for (const ch of l) {
      if (ch === '{') { depth++; inBlock = true; }
      if (ch === '}') { depth--; }
    }
    if (inBlock && depth <= 0) return i;
  }
  return lines.length - 1;
}

const handlers = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes("ipcMain.handle('") || l.includes('ipcMain.handle("')) {
    const m = l.match(/ipcMain\.handle\(['"]([^'"]+)['"]/);
    if (!m) continue;
    const chan = m[1];
    const dom = chan.split(':')[0];

    // Look back for preceding comment
    let blockStart = i;
    if (i > 0 && lines[i-1].trim().startsWith('//')) {
      blockStart = i - 1;
    }

    const end = findMatchingBlock(lines, i);
    const blockLines = lines.slice(blockStart, end + 1);

    handlers.push({
      chan,
      dom,
      start: blockStart,
      end,
      lines: blockLines,
      inSetupIPC: i >= 279 && i <= 1515, // rough estimate
    });
  }
}

// ── Step 2: 合并 domain ─────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────

// 小 domain 合并到大的
const DOMAIN_MERGE = {
  alert: 'alert-notification',
  notification: 'alert-notification',
  order: 'broker',
  trader: 'broker',
  signal: 'broker',
  position: 'broker',
  execution: 'broker',
  pnl: 'broker',
  predict: 'data',
  anomaly: 'data',
  regime: 'data',
  factor: 'data',
  screener: 'data',
  greeks: 'options',
  quote: 'ws',
  push2: 'ws',
  'rate-limiter': 'data',
  nl: 'strategy',
  live: 'strategy',
  paper: 'strategy',
};

const groups = {};
for (const h of handlers) {
  const dom = DOMAIN_MERGE[h.dom] || h.dom;
  if (!groups[dom]) groups[dom] = [];
  groups[dom].push(h);
}

const sortedModules = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

console.log('=== Module Distribution ===');
for (const [name, hs] of sortedModules) {
  const inSetup = hs.filter(h => h.inSetupIPC).length;
  const topLevel = hs.length - inSetup;
  console.log(`  ${name.padEnd(25)} ${String(hs.length).padStart(3)} total  (${topLevel} top-level + ${inSetup} in-setupIPC)`);
}
console.log(`\nTotal: ${handlers.length} handlers in ${sortedModules.length} modules`);

// ── Step 3: 收集handler块中引用的外部依赖 ───────────────────────────
// ─────────────────────────────────────────────────────────────────────

const REF_PATTERNS = [
  /(?<!\.)\bopendClient\b/g,
  /(?<!\.)\bbrokerManager\b/g,
  /(?<!\.)\bstrategyEngine\b/g,
  /(?<!\.)\bbacktestEngine\b/g,
  /(?<!\.)\briskEngine\b/g,
  /(?<!\.)\bliveExecutor\b/g,
  /(?<!\.)\bmarketplaceService\b/g,
  /(?<!\.)\bdataProvider\b/g,
  /(?<!\.)\bemDataProvider\b/g,
  /(?<!\.)\bmacroDataProvider\b/g,
  /(?<!\.)\bstockScreener\b/g,
  /(?<!\.)\bnewsAggregator\b/g,
  /(?<!\.)\bsectorRotation\b/g,
  /(?<!\.)\bstockAnomalyDetector\b/g,
  /(?<!\.)\bmarketHotspot\b/g,
  /(?<!\.)\bdataScheduler\b/g,
  /(?<!\.)\bdb\b/g,
  /(?<!\.)\bWATCHLIST\b/g,
  /(?<!\.)\bmainWindow\b/g,
  /(?<!\.)\bgetDeepSeekKey_\b/g,
  /(?<!\.)\bquotePushHandler\b/g,
  /(?<!\.)\bcalcGreeksJS\b/g,
  /(?<!\.)\bsnapshot\b(?!S)/g,
  /(?<!\.)\bversion\b(?![Ss])/g,
];

const NAME_MAP = {
  opendClient: 'opendClient',
  brokerManager: 'brokerManager',
  strategyEngine: 'strategyEngine',
  backtestEngine: 'backtestEngine',
  riskEngine: 'riskEngine',
  liveExecutor: 'liveExecutor',
  marketplaceService: 'marketplaceService',
  dataProvider: 'dataProvider',
  emDataProvider: 'emDataProvider',
  macroDataProvider: 'macroDataProvider',
  stockScreener: 'stockScreener',
  newsAggregator: 'newsAggregator',
  sectorRotation: 'sectorRotation',
  stockAnomalyDetector: 'stockAnomalyDetector',
  marketHotspot: 'marketHotspot',
  dataScheduler: 'dataScheduler',
  db: 'db',
  WATCHLIST: 'watchlist',
  mainWindow: 'mainWindow',
  getDeepSeekKey_: 'getDeepSeekKey_',
  quotePushHandler: 'quotePushHandler',
  calcGreeksJS: 'calcGreeksJS',
};

function findRefs(blockLines) {
  const body = blockLines.join('\n');
  const refs = new Set();
  for (const p of REF_PATTERNS) {
    p.lastIndex = 0;
    if (p.test(body)) {
      const name = p.source.replace(/.*\\b(\w+).*/, '$1');
      refs.add(name);
    }
  }
  return [...refs].map(n => NAME_MAP[n] || n);
}

// ── Step 4: 生成模块文件 ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────

function toPascal(str) {
  return str.split(/[-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

function generateModule(modName, handlerList) {
  const allRefs = new Set();
  for (const h of handlerList) {
    findRefs(h.lines).forEach(r => allRefs.add(r));
  }

  const out = [];

  out.push(`// ── DAWN WHALES IPC: ${modName} ────────────────────────────────────────────`);
  out.push(`// Auto-split from main.ts — ${handlerList.length} handlers`);
  out.push(`//`);
  out.push(`// Registered channels:`);
  for (const h of handlerList) {
    out.push(`//   ${h.chan}`);
  }
  out.push(``);
  out.push(`import { ipcMain, BrowserWindow } from 'electron';`);
  out.push(``);

  // 参数签名
  const params = [...allRefs].filter(r => r !== 'undefined');
  out.push(`/**`);
  out.push(` * Register all ${modName} IPC handlers`);
  out.push(` *`);
  for (const p of params) {
    out.push(` * @param ${p} - service reference`);
  }
  out.push(` */`);
  out.push(`export function register${toPascal(modName)}IPC(`);
  const paramList = params.map(p => `${p}: any`).join(',\n  ');
  out.push(`  ${paramList}`);
  out.push(`) {`);

  for (const h of handlerList) {
    out.push(``);
    out.push(`  // ── ${h.chan} ───────────────────────────────────────────────`);
    // 把handler block中的每一行加上2空格缩进（如果原来没有缩进）
    const indented = h.lines.map(l => {
      if (l.trim() === '') return '';
      if (l.startsWith('  ')) return l; // 已经有缩进
      return '  ' + l.trim();
    });
    out.push(indented.join('\n'));
  }

  out.push(``);
  out.push(`}`);
  out.push(``);

  return out.join('\n');
}

// 生成文件
const ipcDir = path.join('electron', 'ipc');
if (!fs.existsSync(ipcDir)) fs.mkdirSync(ipcDir, { recursive: true });

for (const [modName, handlerList] of sortedModules) {
  const code = generateModule(modName, handlerList);
  const filePath = path.join(ipcDir, `${modName}-ipc.ts`);
  fs.writeFileSync(filePath, code, 'utf8');
  const linesCount = code.split('\n').length;
  console.log(`  ✅ ${modName}-ipc.ts (${handlerList.length} handlers, ${linesCount} lines)`);
}

// ── Step 5: 生成 index.ts ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────

const indexOut = [];
indexOut.push(`// ── DAWN WHALES IPC — Unified Registration ─────────────────────────`);
indexOut.push(`// Auto-generated. Imports all IPC modules.`);
indexOut.push(``);

// 收集所有需要的imports
const allImportRefs = new Set();
for (const [, handlerList] of sortedModules) {
  for (const h of handlerList) {
    findRefs(h.lines).forEach(r => allImportRefs.add(r));
  }
}

for (const [modName] of sortedModules) {
  const pascal = toPascal(modName);
  indexOut.push(`import { register${pascal}IPC } from './${modName}-ipc';`);
}

indexOut.push(``);
indexOut.push(`export function registerAllIPC(services: {`);
for (const r of [...allImportRefs].sort()) {
  if (r && r !== 'undefined') {
    indexOut.push(`  ${r}: any;`);
  }
}
indexOut.push(`}) {`);

for (const [modName, handlerList] of sortedModules) {
  const pascal = toPascal(modName);
  const refs = new Set();
  for (const h of handlerList) {
    findRefs(h.lines).forEach(r => refs.add(r));
  }
  const args = [...refs]
    .filter(r => r && r !== 'undefined')
    .map(r => `services.${r}`)
    .join(', ');
  indexOut.push(`  register${pascal}IPC(${args});`);
}

indexOut.push(`}`);
indexOut.push(``);

const indexPath = path.join(ipcDir, 'index.ts');
fs.writeFileSync(indexPath, indexOut.join('\n'), 'utf8');
console.log(`\n  ✅ index.ts generated`);

// ── Step 6: 生成 slim main.ts ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────

// 找到需要保留的行范围
// - L1-L278: imports + services + createWindow + quotePushHandler + calcGreeksJS
// - L4265+: createTray + app lifecycle
// - 去掉 L279-L1515 setupIPC 函数
// - 去掉 L1517-L4264 顶层 ipcMain.handle
// 但需要保留 createWindow, createTray, app.whenReady 等

// Approach: 保留 L1-L278，去掉 L279-L4263，保留 L4265+，然后插入 registerAllIPC 调用

const slimLines = [];

// 保留L1-L278 (index 0-277)
for (let i = 0; i <= 277; i++) {
  slimLines.push(lines[i]);
}

// 添加 IPC 注册 import
slimLines.push(`import { registerAllIPC } from './ipc/index';`);
slimLines.push(``);

// 保留 createWindow (L233-L277已经在上面)
// 不需要 setupIPC 函数

// 保留 L4265+: createTray + app lifecycle
for (let i = 4265; i < lines.length; i++) {
  slimLines.push(lines[i]);
}

// 修改 app.whenReady 中的 setupIPC() 调用改为 registerAllIPC()
// 找到 app.whenReady().then(async () => { 并插入 IPC 注册
const slimStr = slimLines.join('\n');
const modified = slimStr.replace(
  /(app\.whenReady\(\)\.then\(async \(\) => \{[\s\S]*?)(setupIPC\(\);)/,
  `$1  // ── Register all IPC handlers from domain modules ──────────────
  registerAllIPC({
    opendClient,
    brokerManager,
    strategyEngine,
    backtestEngine,
    riskEngine,
    liveExecutor,
    marketplaceService,
    dataProvider,
    emDataProvider,
    macroDataProvider,
    stockScreener,
    newsAggregator,
    sectorRotation,
    stockAnomalyDetector,
    marketHotspot,
    dataScheduler,
    db,
    watchlist: WATCHLIST,
    mainWindow,
    getDeepSeekKey_,
    quotePushHandler,
  });`
);

const slimPath = path.join('electron', 'main-slim.ts');
fs.writeFileSync(slimPath, modified, 'utf8');

const origLines = lines.length;
const slimLinesCount = modified.split('\n').length;
const reduction = ((1 - slimLinesCount / origLines) * 100).toFixed(1);

console.log(`\n  📊 main.ts: ${origLines} → main-slim.ts: ${slimLinesCount} lines (${reduction}% reduction)`);
console.log(`\n✅ T7 IPC split complete!`);
