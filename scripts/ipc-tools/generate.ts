/**
 * QUANT MOO — IPC模块自动生成
 * 从 main.ts 中提取339个ipcMain.handle到21个模块文件
 * 
 * 用法: npx tsx electron/ipc/generate.ts
 */

import fs from 'fs';
import path from 'path';

const mainLines = fs.readFileSync('electron/main.ts', 'utf8').split('\n');
const grouping = JSON.parse(fs.readFileSync('electron/ipc/_grouping.json', 'utf8'));

// 导入了哪些服务变量 → 哪些模块需要什么参数
const MODULE_IMPORTS: Record<string, string[]> = {
  em: ['emDataProvider', 'macroDataProvider', 'newsAggregator', 'sectorRotation', 'stockAnomalyDetector', 'marketHotspot', 'mainWindow'],
  indicator: [],
  sentiment: ['mainWindow'],
  data: ['dataProvider', 'stockScreener', 'dataScheduler', 'mainWindow'],
  broker: ['opendClient', 'brokerManager', 'strategyEngine', 'db', 'WATCHLIST', 'mainWindow', 'quotePushHandler', 'riskEngine'],
  risk: ['riskEngine'],
  'alert-notification': [],
  report: [],
  options: [],
  portfolio: [],
  ws: ['mainWindow'],
  backfill: [],
  strategy: ['strategyEngine', 'db', 'opendClient', 'backtestEngine', 'getDeepSeekKey_', 'liveExecutor'],
  backtest: ['backtestEngine'],
  system: [],
  snapshot: [],
  version: [],
  db: ['db'],
  app: ['app', 'mainWindow', 'strategyEngine', 'autoUpdater'],
  marketplace: ['db', 'marketplaceService'],
  cache: [],
};

// 服务变量类型映射
const SERVICE_TYPES: Record<string, string> = {
  opendClient: 'FutuOpenDClient',
  brokerManager: 'BrokerManager',
  strategyEngine: 'StrategyEngine',
  backtestEngine: 'BacktestEngine',
  riskEngine: 'RiskEngine',
  liveExecutor: 'LiveExecutor',
  db: 'DatabaseManager',
  marketplaceService: 'MarketplaceService',
  dataProvider: 'DataProviderService',
  emDataProvider: 'EMDataProvider',
  macroDataProvider: 'MacroDataProvider',
  stockScreener: 'StockScreenerService',
  newsAggregator: 'NewsAggregatorService',
  sectorRotation: 'SectorRotationMonitor',
  stockAnomalyDetector: 'StockAnomalyDetector',
  marketHotspot: 'MarketHotspotService',
  dataScheduler: 'DataSchedulerService',
};

function makeModule(modName: string, handlers: any[]): string {
  const refs = MODULE_IMPORTS[modName] || [];
  const lines: string[] = [];

  // Header
  lines.push(`// ── QUANT MOO IPC — ${modName} ───────────────────────────────────────────`);
  lines.push(`// Auto-generated from main.ts — ${handlers.length} handlers`);
  lines.push('');

  // Imports
  lines.push("import { ipcMain, BrowserWindow, app } from 'electron';");
  lines.push("import { autoUpdater } from 'electron-updater';");

  // Import service types
  const typeImports = new Set<string>();
  for (const r of refs) {
    const t = SERVICE_TYPES[r];
    if (t) typeImports.add(t);
  }
  if (typeImports.size > 0) {
    const types = [...typeImports].sort().join(', ');
    lines.push(`import type { ${types} } from '../broker-files';`);
  }

  // Import schema validation
  lines.push("import { validate } from '../ipc-schemas';");
  lines.push('');

  // Registration function
  const paramList = refs.filter(r => r !== 'app' && r !== 'autoUpdater' && r !== 'WATCHLIST').join(', ');
  const typeAnnotations = refs
    .filter(r => SERVICE_TYPES[r])
    .map(r => `${r}: ${SERVICE_TYPES[r]}`)
    .join(', ');

  lines.push(`export function registerIPC(`);
  if (refs.includes('WATCHLIST')) {
    lines.push(`  watchlist: string[],`);
  }
  if (refs.includes('mainWindow')) {
    lines.push(`  mainWindow: BrowserWindow | null,`);
  }
  // 排序: 先放typed services
  const typedRefs = refs.filter(r => SERVICE_TYPES[r] && r !== 'mainWindow');
  const otherRefs = refs.filter(r => !SERVICE_TYPES[r] && r !== 'mainWindow' && r !== 'WATCHLIST' && r !== 'app' && r !== 'autoUpdater');

  for (const r of typedRefs) {
    lines.push(`  ${r}: ${SERVICE_TYPES[r]} | null,`);
  }
  for (const r of otherRefs) {
    if (r === 'getDeepSeekKey_') {
      lines.push(`  getDeepSeekKey_: (app: any) => string,`);
    } else if (r === 'quotePushHandler') {
      lines.push(`  quotePushHandler: (quotes: any[]) => void,`);
    } else if (r === 'calcGreeksJS') {
      lines.push(`  calcGreeksJS: (spot: number, strike: number, vol: number, days: number, rate: number, type: 'CALL' | 'PUT') => any,`);
    } else {
      lines.push(`  ${r}: any,`);
    }
  }

  // Remove trailing comma from last param
  if (lines[lines.length - 1].endsWith(',')) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  }
  lines.push(`) {`);

  // Add handler code
  for (const h of handlers) {
    const handlerCode = h.lines.join('\n');
    // 移除外层调用它不需要的上下文（比如setupIPC函数包装）
    lines.push('');
    lines.push(`  // ── ${h.chan} ─────────────────────────────────────────`);
    lines.push('  ' + handlerCode.trim());
  }

  lines.push('');
  lines.push('}');

  return lines.join('\n');
}

// 生成各模块文件
const indexPath = path.join('electron', 'ipc');
for (const [modName, handlers] of Object.entries(grouping)) {
  const code = makeModule(modName, handlers);
  const filePath = path.join(indexPath, `${modName}-ipc.ts`);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`Generated: ${filePath} (${handlers.length} handlers, ${code.split('\n').length} lines)`);
}

// 生成 index.ts
const indexLines: string[] = [
  "// ── QUANT MOO IPC — Unified Registration ───────────────────────────────",
  "// Auto-generated — imports all 21 IPC modules",
  "",
  "import { ipcMain, BrowserWindow, app } from 'electron';",
  "import { autoUpdater } from 'electron-updater';",
  "",
];

const moduleNames = Object.keys(grouping).sort();
for (const name of moduleNames) {
  indexLines.push(`import { registerIPC as register${toPascal(name)} } from './${name}-ipc';`);
}

indexLines.push('');
indexLines.push('export interface IPCServices {');
indexLines.push('  opendClient: any;');
indexLines.push('  brokerManager: any;');
indexLines.push('  strategyEngine: any;');
indexLines.push('  backtestEngine: any;');
indexLines.push('  riskEngine: any;');
indexLines.push('  liveExecutor: any;');
indexLines.push('  db: any;');
indexLines.push('  marketplaceService: any;');
indexLines.push('  dataProvider: any;');
indexLines.push('  emDataProvider: any;');
indexLines.push('  macroDataProvider: any;');
indexLines.push('  stockScreener: any;');
indexLines.push('  newsAggregator: any;');
indexLines.push('  sectorRotation: any;');
indexLines.push('  stockAnomalyDetector: any;');
indexLines.push('  marketHotspot: any;');
indexLines.push('  dataScheduler: any;');
indexLines.push('  mainWindow: BrowserWindow | null;');
indexLines.push('  watchlist: string[];');
indexLines.push('  getDeepSeekKey_: (app: any) => string;');
indexLines.push('  quotePushHandler: (quotes: any[]) => void;');
indexLines.push('}');
indexLines.push('');
indexLines.push('export function registerAllIPC(services: IPCServices) {');

for (const name of moduleNames) {
  const pascal = toPascal(name);
  const refs = MODULE_IMPORTS[name] || [];
  
  const args = refs.map(r => {
    if (r === 'WATCHLIST') return 'services.watchlist';
    if (r === 'app') return 'app';
    if (r === 'autoUpdater') return 'autoUpdater';
    return `services.${r}`;
  });

  indexLines.push(`  register${pascal}(`);
  indexLines.push(`    ${args.join(',\n    ')}`);
  indexLines.push(`  );`);
}

indexLines.push('}');

fs.writeFileSync(path.join(indexPath, 'index.ts'), indexLines.join('\n'), 'utf8');
console.log(`\nGenerated: electron/ipc/index.ts`);

function toPascal(str: string): string {
  return str.split(/[-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

console.log('\n✅ All IPC modules generated!');
