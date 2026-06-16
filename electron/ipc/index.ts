// ── QUANT MOO IPC — Unified Registration ─────────────────────────
// Auto-generated. Imports all 22 IPC modules.
//
// Usage in main.ts:
//   import { registerAllIPC } from './ipc';
//   registerAllIPC({ ... all services ... });

import { registerAlertNotificationIPC } from './alert-notification-ipc';
import { registerAppIPC } from './app-ipc';
import { registerBackfillIPC } from './backfill-ipc';
import { registerBacktestIPC } from './backtest-ipc';
import { registerBrokerIPC } from './broker-ipc';
import { registerCacheIPC } from './cache-ipc';
import { registerDataIPC } from './data-ipc';
import { registerDbIPC } from './db-ipc';
import { registerEmIPC } from './em-ipc';
import { registerIndicatorIPC } from './indicator-ipc';
import { registerMarketplaceIPC } from './marketplace-ipc';
import { registerOptionsIPC } from './options-ipc';
import { registerPortfolioIPC } from './portfolio-ipc';
import { registerPyIPC } from './py-ipc';
import { registerReportIPC } from './report-ipc';
import { registerRiskIPC } from './risk-ipc';
import { registerSentimentIPC } from './sentiment-ipc';
import { registerSnapshotIPC } from './snapshot-ipc';
import { registerStockStreamIPC } from './stock-stream-ipc';
import { registerStrategyIPC } from './strategy-ipc';
import { registerSystemIPC } from './system-ipc';
import { registerVersionIPC } from './version-ipc';
import { registerCockpitIPC } from './cockpit-ipc';
import { registerWsIPC } from './ws-ipc';
import { registerWsMarketIpcHandlers } from './ws-market-ipc';

export function registerAllIPC(services: {
  BrokerConfig: unknown;
  STRATEGY_UPDATE_WHITELIST: unknown;
  WATCHLIST: unknown;
  _services: unknown;
  app: unknown;
  backtestEngine: unknown;
  brokerManager: unknown;
  calcGreeksJS: unknown;
  dataProvider: unknown;
  dataScheduler: unknown;
  db: unknown;
  emDataProvider: unknown;
  flowPredictor: unknown;
  liveExecutor: unknown;
  macroDataProvider: unknown;
  mainWindow: unknown;
  marketHotspot: unknown;
  marketplaceService: unknown;
  multiBrokerPnL: unknown;
  newsAggregator: unknown;
  opendClient: unknown;
  orderRouter: unknown;
  positionAlertEngine: unknown;
  quotePushHandler: unknown;
  riskEngine: unknown;
  sectorRotation: unknown;
  sentimentAttrEngine: unknown;
  signalQualityScorer: unknown;
  stockAnomalyDetector: unknown;
  stockScreener: unknown;
  strategyEngine: unknown;
  tcaEngine: unknown;
  unifiedRiskDash: unknown;
}) {
  registerAlertNotificationIPC(services._services);
  registerAppIPC(services.mainWindow, services.strategyEngine);
  registerBackfillIPC(services._services);
  registerBacktestIPC(services.backtestEngine);
  registerBrokerIPC(services.opendClient, services.brokerManager, services.strategyEngine, services.db, services.WATCHLIST, services.mainWindow, services.quotePushHandler, services.riskEngine, services.orderRouter, services.tcaEngine, services.multiBrokerPnL, services.BrokerConfig, services.signalQualityScorer, services.positionAlertEngine);
  registerCacheIPC(services._services);
  registerDataIPC(services.dataProvider, services.stockScreener, services.dataScheduler, services.mainWindow, services.flowPredictor);
  registerDbIPC(services.db);
  registerEmIPC(services.emDataProvider, services.macroDataProvider, services.newsAggregator, services.sectorRotation, services.stockAnomalyDetector, services.marketHotspot, services.mainWindow);
  registerIndicatorIPC(services._services);
  registerMarketplaceIPC(services.db, services.marketplaceService);
  registerOptionsIPC(services.calcGreeksJS);
  registerPortfolioIPC(services._services);
  registerPyIPC();
  registerReportIPC(services._services);
  registerRiskIPC(services.riskEngine, services.unifiedRiskDash);
  registerSentimentIPC(services.mainWindow, services.sentimentAttrEngine);
  registerSnapshotIPC(services._services);
  registerStockStreamIPC();
  registerStrategyIPC(services.strategyEngine, services.db, services.opendClient, services.backtestEngine, services.liveExecutor, services.app, services.STRATEGY_UPDATE_WHITELIST);
  registerSystemIPC(services._services);
  registerVersionIPC(services._services);
  registerWsIPC(services.mainWindow);
  registerWsMarketIpcHandlers();
  registerCockpitIPC(services.mainWindow);
}
