// -- IPC Handlers: Shared State & Imports --
import type { BrowserWindow, Tray } from 'electron';
import type { FutuOpenDClient } from '../broker/futu-opend';
import type { BrokerManager } from '../broker/BrokerManager';
import type { StrategyEngine } from '../engine/strategy-engine';
import type { BacktestEngine } from '../engine/backtest-engine';
import type { DatabaseManager } from '../data/database';
import type { RiskEngine } from '../engine/risk-engine';
import type { MarketplaceService } from '../data/marketplace-service';
import type { DataProviderService } from '../data/data-provider';
import type { BrokerConfig } from '../broker/IBrokerAdapter';

export interface SharedState {
  mainWindow: BrowserWindow | null;
  tray: Tray | null;
  opendClient: FutuOpenDClient | null;
  brokerManager: BrokerManager | null;
  strategyEngine: StrategyEngine | null;
  backtestEngine: BacktestEngine | null;
  riskEngine: RiskEngine | null;
  db: DatabaseManager | null;
  marketplaceService: MarketplaceService | null;
  dataProvider: DataProviderService | null;
  WATCHLIST: string[];
  quotePushHandler: ((quotes: any[]) => void) | null;
}

export const shared: SharedState = {
  mainWindow: null,
  tray: null,
  opendClient: null,
  brokerManager: null,
  strategyEngine: null,
  backtestEngine: null,
  riskEngine: null,
  db: null,
  marketplaceService: null,
  dataProvider: null,
  WATCHLIST: ['US.TQQQ','US.SOXL','US.QQQ','US.SPY','US.AAPL','US.NVDA','US.SQQQ','US.SOXS'],
  quotePushHandler: null,
};

import { validate as _validate } from '../ipc-schemas';
export { _validate as validate };
export type { BrokerConfig };
