/**
 * Fix IPC modules path — 修正所有相对路径 + 添加通用 import
 */
const fs = require('fs');
const path = require('path');

const ipcDir = path.join('electron', 'ipc');
const files = fs.readdirSync(ipcDir).filter(f => f.endsWith('-ipc.ts'));

// 通用imports — 每个模块都可能需要
const COMMON_IMPORTS = `import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from '../../node_modules/electron-log';
import { validate, z, 
  BrokerConnectSchema, BrokerGetFundsSchema, BrokerGetPositionsSchema,
  BrokerGetQuotesSchema, BrokerSubscribeSchema, BrokerGetKlinesSchema,
  BrokerPlaceOrderSchema, BrokerCancelOrderSchema,
  BrokerSwitchSchema, BrokerAddSchema,
  StrategyCreateSchema, StrategyUpdateSchema, StrategyGetSchema,
  StrategyBacktestSchema, BacktestMultiPeriodSchema,
  BacktestParamSweepSchema, BacktestRiskMetricsSchema,
  BacktestWalkForwardSchema, BacktestParamScanSchema,
  BacktestMultiTimeframeSchema,
  RiskUpdateConfigSchema, RiskUpdateVixSchema,
  DbSaveStrategySchema, DbSaveSettingsSchema, DbSaveWatchlistSchema,
  DbGetTradesSchema, DbGetBacktestResultsSchema, DbGetSignalsSchema,
  DbSaveFundamentalSchema, DbSaveCapitalFlowSchema,
  DbSaveRegimeSchema, DbSaveAnomalySchema, DbSaveNewsSchema,
  DataComputeRegimeSchema,
  MarketplaceRateSchema, MarketplaceCommentSchema,
  MarketplaceSavePerformanceSchema, MarketplaceListSchema,
  GreeksCalculateSchema, GreeksPortfolioSchema,
  DataNewsSchema, DataFundamentalSchema,
  DataCapitalFlowSchema, DataAnomaliesSchema,
  DataCompositeScoreSchema,
  NlParseSchema, StrategyExplainSchema,
  StrategyCompareSchema, StrategyOptimizeSchema,
  StrategyCorrelationSchema,
  NotificationGenerateSchema,
  ReportGenerateSchema, ReportQuickSchema,
  StrategyAutoTuneSchema,
} from '../ipc-schemas';`;

const COMMON_TYPES = `
import type { BrokerConfig } from '../broker/IBrokerAdapter';
import type { SmartAlert, NotificationContext } from '../engine/notification-engine';
import type { ParamRange } from '../engine/auto-tuner';
import type { RegimeLabel } from '../engine/regime-detector';`;

// 路径前缀修正 — ipc/ 中的模块相对路径需要加 ../
for (const file of files) {
  if (file === 'generate.ts' || file === 'split.ts' || file === 'fix-imports.ts') continue;
  
  const filePath = path.join(ipcDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 替换 `import { ipcMain, BrowserWindow } from 'electron'` 为通用imports
  content = content.replace(
    /import\s*\{[^}]*\}\s*from\s*['"]electron['"];?/,
    COMMON_IMPORTS
  );
  
  // 修正所有 from './ 的相对路径
  // from './engine/' → from '../engine/'
  // from './data/' → from '../data/'
  // from './broker/' → from '../broker/'
  content = content.replace(/from\s+['"]\.\/engine\//g, "from '../engine/");
  content = content.replace(/from\s+['"]\.\/data\//g, "from '../data/");
  content = content.replace(/from\s+['"]\.\/broker\//g, "from '../broker/");
  content = content.replace(/from\s+['"]\.\/utils\//g, "from '../utils/");
  
  // 修正 electron-log 的路径
  content = content.replace(/from\s+['"]electron-log['"]/, "import log from 'electron-log'");
  
  // 确保有 log import（如果没有）
  if (!content.includes("import log") && !content.includes("from 'electron-log'")) {
    content = content.replace(/import { ipcMain, BrowserWindow, app, shell } from 'electron';/,
      "import { ipcMain, BrowserWindow, app, shell } from 'electron';\nimport log from 'electron-log';");
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${file}: paths fixed`);
}

console.log('\n✅ All IPC module paths fixed!');
