// ── DAWN WHALES IPC — Unified Registration ─────────────────────────
// Auto-generated. Imports all IPC modules.

import { registerEmIPC } from './em-ipc';
import { registerDataIPC } from './data-ipc';
import { registerStrategyIPC } from './strategy-ipc';
import { registerBrokerIPC } from './broker-ipc';
import { registerWsIPC } from './ws-ipc';
import { registerRiskIPC } from './risk-ipc';
import { registerSnapshotIPC } from './snapshot-ipc';
import { registerVersionIPC } from './version-ipc';
import { registerCacheIPC } from './cache-ipc';
import { registerAppIPC } from './app-ipc';
import { registerMarketplaceIPC } from './marketplace-ipc';
import { registerDbIPC } from './db-ipc';
import { registerSentimentIPC } from './sentiment-ipc';
import { registerPortfolioIPC } from './portfolio-ipc';
import { registerBacktestIPC } from './backtest-ipc';
import { registerIndicatorIPC } from './indicator-ipc';
import { registerAlertNotificationIPC } from './alert-notification-ipc';
import { registerReportIPC } from './report-ipc';
import { registerOptionsIPC } from './options-ipc';
import { registerBackfillIPC } from './backfill-ipc';
import { registerPyIPC } from './py-ipc';
import { registerSystemIPC } from './system-ipc';

export function registerAllIPC(services: {
  backtestEngine: any;
  brokerManager: any;
  calcGreeksJS: any;
  dataProvider: any;
  dataScheduler: any;
  db: any;
  emDataProvider: any;
  getDeepSeekKey_: any;
  liveExecutor: any;
  macroDataProvider: any;
  mainWindow: any;
  marketHotspot: any;
  marketplaceService: any;
  newsAggregator: any;
  opendClient: any;
  quotePushHandler: any;
  riskEngine: any;
  sectorRotation: any;
  snapshot: any;
  stockAnomalyDetector: any;
  stockScreener: any;
  strategyEngine: any;
  version: any;
  watchlist: any;
}) {
  registerEmIPC(services.emDataProvider, services.macroDataProvider, services.newsAggregator, services.sectorRotation, services.snapshot, services.stockAnomalyDetector, services.marketHotspot, services.mainWindow);
  registerDataIPC(services.dataProvider, services.stockScreener, services.dataScheduler, services.mainWindow);
  registerStrategyIPC(services.strategyEngine, services.db, services.opendClient, services.backtestEngine, services.getDeepSeekKey_, services.liveExecutor);
  registerBrokerIPC(services.opendClient, services.brokerManager, services.strategyEngine, services.db, services.watchlist, services.mainWindow, services.quotePushHandler, services.riskEngine);
  registerWsIPC(services.mainWindow);
  registerRiskIPC(services.riskEngine, services.snapshot);
  registerSnapshotIPC(services.snapshot);
  registerVersionIPC(services.version);
  registerCacheIPC();
  registerAppIPC(services.version, services.mainWindow, services.strategyEngine);
  registerMarketplaceIPC(services.db, services.marketplaceService);
  registerDbIPC(services.db);
  registerSentimentIPC(services.mainWindow);
  registerPortfolioIPC();
  registerBacktestIPC(services.backtestEngine);
  registerIndicatorIPC();
  registerAlertNotificationIPC();
  registerReportIPC();
  registerOptionsIPC(services.calcGreeksJS);
  registerBackfillIPC();
  registerPyIPC();
  registerSystemIPC();
}
