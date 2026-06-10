��// ── DAWN WHALES — Electron Main Process ────────────────────────────────────
// 架构对齐：富途牛牛桌面端 (Electron + C++ core + React)
// 我们用：Electron + Node.js (Main) + React (Renderer)

import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { autoUpdater } from 'electron-updater';
import { FutuOpenDClient } from './broker/futu-opend';
import { BrokerManager } from './broker/BrokerManager';
import type { BrokerConfig } from './broker/IBrokerAdapter';
import { StrategyEngine } from './engine/analysis/strategy-engine';
import { BacktestEngine } from './engine/backtest/backtest-engine';
import { DatabaseManager } from './data/database';
import { RiskEngine } from './engine/risk/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from './engine/agents/nl-parser';
import { MarketplaceService } from './data/marketplace-service';
import { DataProviderService } from './data/data-provider';
import { z } from 'zod';
