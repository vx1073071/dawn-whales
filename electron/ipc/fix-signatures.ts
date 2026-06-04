/**
 * Fix IPC module signatures — 替换 `_services: any` 为具体参数
 */
const fs = require('fs');
const path = require('path');

const ipcDir = path.join('electron', 'ipc');
const files = fs.readdirSync(ipcDir).filter(f => f.endsWith('-ipc.ts'));

// 每个模块需要的参数 — 从之前 _refs.json 读取
const refsData = {
  'em': ['emDataProvider', 'macroDataProvider', 'newsAggregator', 'sectorRotation', 'stockAnomalyDetector', 'marketHotspot', 'mainWindow'],
  'indicator': [],
  'sentiment': ['mainWindow'],
  'data': ['dataProvider', 'stockScreener', 'dataScheduler', 'mainWindow'],
  'broker': ['opendClient', 'brokerManager', 'strategyEngine', 'db', 'WATCHLIST', 'mainWindow', 'quotePushHandler', 'riskEngine'],
  'risk': ['riskEngine'],
  'alert-notification': [],
  'report': [],
  'options': ['calcGreeksJS'],
  'portfolio': [],
  'ws': ['mainWindow'],
  'backfill': [],
  'strategy': ['strategyEngine', 'db', 'opendClient', 'backtestEngine', 'getDeepSeekKey_', 'liveExecutor', 'app'],
  'backtest': ['backtestEngine'],
  'system': [],
  'snapshot': [],
  'version': [],
  'db': ['db'],
  'app': ['mainWindow', 'strategyEngine'],
  'marketplace': ['db', 'marketplaceService'],
  'cache': [],
};

// 额外从内容扫描的变量引用
const extraRefs = {
  'broker': ['orderRouter', 'tcaEngine', 'multiBrokerPnL', 'BrokerConfig', 'signalQualityScorer', 'positionAlertEngine'],
  'strategy': ['STRATEGY_UPDATE_WHITELIST'],
  'data': ['flowPredictor'],
  'sentiment': ['sentimentAttrEngine'],
  'risk': ['unifiedRiskDash'],
};

for (const file of files) {
  const modName = file.replace('-ipc.ts', '');
  const filePath = path.join(ipcDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const refs = refsData[modName] || [];
  const extras = extraRefs[modName] || [];
  const allRefs = [...new Set([...refs, ...extras])];
  
  // 替换函数签名
  if (allRefs.length > 0) {
    const params = allRefs.map(r => `${r}: any`).join(',\n  ');
    const newSig = `export function register${toPascal(modName)}IPC(\n  ${params}\n) {`;
    
    content = content.replace(
      /export function register\w+IPC\(\s*\n\s*_services: any\s*\n\s*\)/g,
      newSig
    );
    
    // Also handle single-line version
    const singleLineRegex = new RegExp(
      `export function register${toPascal(modName)}IPC\\(\\s*_services: any\\s*\\)`,
      'g'
    );
    content = content.replace(singleLineRegex, `export function register${toPascal(modName)}IPC(${allRefs.map(r => `${r}: any`).join(', ')})`);
  }
  
  // 修复 z 的问题 — remove z from imports if not exported
  content = content.replace(/,\s*z\b/g, '');
  content = content.replace(/validate,\s*z\b/g, 'validate');
  content = content.replace(/z,\s*validate\b/g, 'validate');
  
  // 修复 ALLOWED_PROTOCOLS — 这在main.ts中定义的
  if (content.includes('ALLOWED_PROTOCOLS')) {
    content = content.replace('ALLOWED_PROTOCOLS', "['https:', 'http:', 'ftp:']");
  }
  
  // 修复 electron-log import
  content = content.replace(
    /import\s+\{\s*ipcMain,\s*BrowserWindow,\s*app,\s*shell\s*\}\s*from\s*['"]electron['"];\s*\n\s*import\s+log\s+from\s+['"][^'"]*['"];/g,
    "import { ipcMain, BrowserWindow, app, shell } from 'electron';\nimport log from 'electron-log';"
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('✅ Signatures fixed');

function toPascal(str) {
  return str.split(/[-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}
