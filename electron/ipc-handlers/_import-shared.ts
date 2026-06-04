// ── IPC Handlers — Shared Types & Variables ─────────────────────────────────
// 所有 IPC handler 模块共享的类型和变量引用
// 主龙虾拆分 main.ts 时的共享层

import type { BrowserWindow, Tray } from 'electron';
import type { FutuOpenDClient } from '../broker/futu-opend';
import type { BrokerManager } from '../broker/BrokerManager';
import type { StrategyEngine } from '../engine/strategy-engine';
import type { BacktestEngine } from '../engine/backtest-engine';
import type { DatabaseManager } from '../data/database';
import type { RiskEngine } from '../engine/risk-engine';
import type { MarketplaceService } from '../data/marketplace-service';
import type { DataProviderService } from '../data/data-provider';

// ── Shared State Container ──────────────────────────────────────────────────
// 所有模块通过此对象访问主进程状态

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
}

// 全局共享状态（由 main.ts 初始化）
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
};

// ── Validation Helper ─────────────────────────────────────────────────────
import { z } from 'zod';

export function validate(schema: z.ZodSchema, data: any): { success: false; error: string } | null {
  try {
    schema.parse(data);
    return null;
  } catch (err: any) {
    return { success: false, error: `Validation failed: ${err.message}` };
  }
}

// ── Utility Functions ───────────────────────────────────────────────────────

export function isDev(): boolean {
  const { app } = require('electron');
  return !app.isPackaged;
}

export function getResourcesPath(): string {
  const { app } = require('electron');
  const path = require('path');
  return isDev() 
    ? path.join(__dirname, '..') 
    : path.join(process.resourcesPath, 'resources');
}
