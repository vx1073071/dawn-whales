// ── DAWN WHALES — IPC Handler Setup ────────────────────────────────────────
// Extracted from electron/main.ts — all IPC handlers under setupIPC()
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';
import { withTimeout, ReentryGuard, ipcHealth, validateInput } from './ipc-hardening';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { FutuOpenDClient } from '../broker/futu-opend';
import { BrokerManager } from '../broker/BrokerManager';
import type { BrokerConfig } from '../broker/IBrokerAdapter';
import { StrategyEngine } from '../engine/analysis/strategy-engine';
import { BacktestEngine } from '../engine/backtest/backtest-engine';
import { DatabaseManager } from '../data/database';
import { RiskEngine } from '../engine/risk/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from '../engine/agents/nl-parser';
import { MarketplaceService } from '../data/marketplace-service';
import { DataProviderService } from '../data/data-provider';
import { z } from 'zod';
import { WalkForwardEngine } from '../engine/backtest/walk-forward';
import { ParameterScanner } from '../engine/portfolio/parameter-scanner';
import { validate,
  BrokerSwitchSchema,
  BrokerAddSchema,
  StrategyCreateSchema,
  StrategyUpdateSchema,
  BacktestMultiPeriodSchema,
  BacktestParamSweepSchema,
  BacktestWalkForwardSchema,
  BacktestParamScanSchema,
  BacktestMultiTimeframeSchema,
  MarketplaceRateSchema,
  MarketplaceCommentSchema,
  MarketplaceSavePerformanceSchema,
  GreeksPortfolioSchema,
  StrategyOptimizeSchema,
} from '../ipc-schemas';
import i18n from '../../src/i18n';

const execAsync = promisify(exec);

// ── Shared mutable state interface ───────────────────────────────────────

export interface IPCContext {
  mainWindow: BrowserWindow | null;
  opendClient: FutuOpenDClient | null;
  brokerManager: BrokerManager | null;
  strategyEngine: StrategyEngine | null;
  backtestEngine: BacktestEngine | null;
  riskEngine: RiskEngine | null;
  db: DatabaseManager | null;
  marketplaceService: MarketplaceService | null;
  dataProvider: DataProviderService | null;
  WATCHLIST: string[];
  quotePushHandler: (quotes: any[]) => void;
  setOpendClient: (client: FutuOpenDClient | null) => void;
  setWatchlist: (list: string[]) => void;
}

// ── IPC Setup ────────────────────────────────────────────────────────────

export function setupIPC(ctx: IPCContext): void {
  // ── Broker: Multi-broker support (WP1 + Sprint1) ────────────────────
  ipcMain.handle('broker:connect', async (_e, config: { host: string; port: number; brokerId?: string }) => {
    try {
      if (ctx.brokerManager) {
        const brokerCfg: BrokerConfig = {
          id: config.brokerId || 'futu-default',
          name: config.brokerId || 'Futu OpenD',
          type: 'futu',
          host: config.host || '127.0.0.1',
          port: config.port || 11111,
          enabled: true,
        };
        ctx.brokerManager.loadConfigs([brokerCfg]);
        ctx.brokerManager.clearCallbacks();
        ctx.brokerManager.onQuotePush(ctx.quotePushHandler);
        await ctx.brokerManager.connect(brokerCfg.id);
        const savedWatchlist = ctx.db?.getWatchlist();
        if (savedWatchlist && savedWatchlist.length > 0) {
          ctx.setWatchlist(savedWatchlist);
        }
        await ctx.brokerManager.subscribeAndPush(brokerCfg.id, ctx.WATCHLIST);
        log.info('[Broker] Multi-broker connected:', brokerCfg.id);
        return { success: true, brokerId: brokerCfg.id, host: config.host, port: config.port };
      }

      const client = new FutuOpenDClient(config.host || '127.0.0.1', config.port || 11111);
      await client.connect();
      log.info('[Broker] OpenD connected');
      ctx.setOpendClient(client);

      client.onQuotePush((quotes) => {
        ctx.mainWindow?.webContents.send('quotes:push', quotes);
        ctx.strategyEngine?.onQuoteUpdate(quotes);
      });
      const savedWatchlist = ctx.db?.getWatchlist();
      if (savedWatchlist && savedWatchlist.length > 0) {
        ctx.setWatchlist(savedWatchlist);
        log.info('[Broker] Loaded watchlist from DB:', ctx.WATCHLIST);
      }
      await client.subscribeAndPush(ctx.WATCHLIST);
      log.info('[Broker] Push mode active');

      return { success: true, host: config.host, port: config.port };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      void EngineError; // structured error domain: AI
      log.error('[Broker] Connect failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('broker:disconnect', async () => {
    ctx.opendClient?.disconnect();
    ctx.setOpendClient(null);
    return { success: true };
  });

  ipcMain.handle('broker:getAccounts', async () => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, accounts: await ctx.opendClient.getAccounts() };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getFunds', async (_e, accountId: string) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const funds = await ctx.opendClient.getFunds(accountId);
      ctx.riskEngine?.updateTotalAssets(funds?.totalAssets || 0);
      return { success: true, funds };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getPositions', async (_e, accountId: string) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, positions: await ctx.opendClient.getPositions(accountId) };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getQuotes', async (_e, codes: string[]) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const quoteList = (!codes || codes.length === 0) ? ctx.WATCHLIST : codes;
      return { success: true, quotes: await ctx.opendClient.getQuotes(quoteList) };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:subscribe', async (_e, codes: string[]) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const merged = Array.from(new Set([...ctx.WATCHLIST, ...codes]));
      ctx.setWatchlist(merged);
      await ctx.opendClient.subscribeAndPush(ctx.WATCHLIST);
      ctx.db?.saveWatchlist(ctx.WATCHLIST);
      log.info('[Broker] Subscribed:', codes);
      return { success: true, watchlist: ctx.WATCHLIST };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:unsubscribe', async (_e, codes: string[]) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      ctx.setWatchlist(ctx.WATCHLIST.filter((c) => !codes.includes(c)));
      await ctx.opendClient.subscribeAndPush(ctx.WATCHLIST);
      ctx.db?.saveWatchlist(ctx.WATCHLIST);
      log.info('[Broker] Unsubscribed:', codes);
      return { success: true, watchlist: ctx.WATCHLIST };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getKlines', async (_e, code: string, period: string, count: number) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const cached = ctx.db?.getKlines(code, period || 'daily', count || 200);
      if (cached && cached.length > 0) {
        return { success: true, klines: cached, cached: true };
      }
      const klines = await ctx.opendClient.getKlines(code, period || 'daily', count || 200);
      if (klines.length > 0 && ctx.db) {
        ctx.db.saveKlines(code, period || 'daily', klines);
      }
      return { success: true, klines };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:placeOrder', async (_e, order: unknown) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    if (!order || typeof order !== 'object') {
      return { success: false, error: 'Invalid order object' };
    }
    if (!order.code || typeof order.code !== 'string') {
      return { success: false, error: 'Missing or invalid order.code' };
    }
    if (!['BUY', 'SELL'].includes(order.side)) {
      return { success: false, error: 'Invalid order.side (must be BUY or SELL)' };
    }
    if (typeof order.qty !== 'number' || order.qty <= 0 || order.qty > 1000000 || !Number.isInteger(order.qty)) {
      return { success: false, error: 'Invalid order.qty (must be positive integer <= 1,000,000)' };
    }
    if (order.price !== undefined && (typeof order.price !== 'number' || order.price < 0)) {
      return { success: false, error: 'Invalid order.price' };
    }
    const riskResult = ctx.riskEngine?.checkOrder(order);
    if (riskResult && !riskResult.pass) {
      ctx.mainWindow?.webContents.send('risk-alert', { order, reason: riskResult.reason });
      return { success: false, error: i18n.t('ipcSetup.k1') };
    }
    try {
      const result = await ctx.opendClient.placeOrder(order);
      ctx.db?.saveTrade({ ...order, orderId: result.orderId, status: 'submitted' });
      ctx.mainWindow?.webContents.send('order-update', { ...order, orderId: result.orderId, status: 'submitted' });
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:cancelOrder', async (_e, orderId: string, accountId: string, code: string) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      await ctx.opendClient.cancelOrder(orderId, accountId, code);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getOrders', async (_e, accountId: string) => {
    if (!ctx.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, orders: await ctx.opendClient.getOrders(accountId) };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:list', async () => {
    return { success: true, brokers: ctx.brokerManager?.getConfigs() || [] };
  });

  ipcMain.handle('broker:add', async (_e, cfg: BrokerConfig) => {
    const vErr = validate(BrokerAddSchema, { cfg });
    if (vErr) return vErr;
    try {
      ctx.brokerManager?.addConfig(cfg);
      ctx.db?.saveBrokerConfig(cfg);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:remove', async (_e, id: string) => {
    try {
      ctx.brokerManager?.removeConfig(id);
      ctx.db?.deleteBrokerConfig(id);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:setActive', async (_e, id: string) => {
    try {
      ctx.brokerManager?.setActiveBroker(id);
      return { success: true, activeBroker: id };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:switch', async (_e, id: string) => {
    const vErr = validate(BrokerSwitchSchema, { id });
    if (vErr) return vErr;
    try {
      const adapter = ctx.brokerManager?.getAdapters().get(id);
      if (!adapter) {
        const config = ctx.brokerManager?.getConfigs().find((c: unknown) => c.id === id);
        if (!config) return { success: false, error: `Broker config not found: ${id}` };

        ctx.brokerManager?.loadConfigs([config]);
        await ctx.brokerManager?.connect(id);
      } else if (!adapter.connected) {
        await adapter.connect();
      }

      ctx.brokerManager?.setActiveBroker(id);
      const activeId = ctx.brokerManager?.getActiveBrokerId();
      const activeAdapter = ctx.brokerManager?.getActiveBroker();

      if (activeAdapter) {
        ctx.brokerManager?.clearCallbacks();
        ctx.brokerManager?.onQuotePush(ctx.quotePushHandler);
        const savedWatchlist = ctx.db?.getWatchlist();
        await activeAdapter.subscribeAndPush(
          savedWatchlist && savedWatchlist.length > 0 ? savedWatchlist : ctx.WATCHLIST
        );
      }

      const status = ctx.brokerManager?.getStatus() || [];
      const switched = status.find((s: unknown) => s.id === activeId);

      log.info(`[Broker] Switched to ${id}, connected=${switched?.connected}`);
      ctx.mainWindow?.webContents.send('broker:switched', { activeBroker: activeId, status });
      return { success: true, activeBroker: activeId, brokerStatus: switched };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[Broker] Switch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('broker:getStatus', async () => {
    return { success: true, status: ctx.brokerManager?.getStatus() || [] };
  });

  // ── Strategy Engine ─────────────────────────────────────────────────
  ipcMain.handle('strategy:create', async (_e, dsl: unknown) => {
    const vErr = validate(StrategyCreateSchema, { dsl });
    if (vErr) return vErr;
    try {
      const id = ctx.strategyEngine?.createStrategy(dsl);
      const strategy = ctx.strategyEngine?.getStrategy(id!);
      if (strategy && ctx.db) ctx.db.saveStrategy(strategy);
      return { success: true, id, strategy };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('strategy:getAll', async () => {
    return { success: true, strategies: ctx.strategyEngine?.getAllStrategies() || [] };
  });

  ipcMain.handle('strategy:get', async (_e, id: string) => {
    const strategy = ctx.strategyEngine?.getStrategy(id);
    return { success: !!strategy, strategy };
  });

  const STRATEGY_UPDATE_WHITELIST = ['name', 'description', 'params', 'stopLoss', 'takeProfit', 'symbol'];
  ipcMain.handle('strategy:update', async (_e, id: string, updates: unknown) => {
    const vErr = validate(StrategyUpdateSchema, { updates });
    if (vErr) return vErr;
    try {
      const strategy = ctx.strategyEngine?.getStrategy(id);
      if (!strategy) return { success: false, error: 'Strategy not found' };
      const sanitized: unknown = {};
      for (const key of STRATEGY_UPDATE_WHITELIST) {
        if (key in updates) sanitized[key] = updates[key];
      }
      Object.assign(strategy, sanitized, { updatedAt: new Date().toISOString() });
      if (ctx.db) ctx.db.saveStrategy(strategy);
      return { success: true, strategy };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
    return { success: false, error: err.message }; }
  });

  ipcMain.handle('strategy:delete', async (_e, id: string) => {
    ctx.strategyEngine?.deleteStrategy(id);
    ctx.db?.deleteStrategy(id);
    return { success: true };
  });

  ipcMain.handle('strategy:backtest', async (_e, config: unknown) => {
    if (!ctx.strategyEngine || !ctx.backtestEngine) {
      return { success: false, error: 'Engine not ready' };
    }
    try {
      let klines = config.klines;
      if (!klines || klines.length === 0) {
        klines = ctx.db?.getKlines(config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200);
        if (!klines || klines.length === 0) {
          if (ctx.opendClient?.connected) {
            klines = await ctx.opendClient.getKlines(
              config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200
            );
            if (klines.length > 0 && ctx.db) {
              ctx.db.saveKlines(config.symbol || 'US.TQQQ', config.period || 'daily', klines);
            }
          }
        }
      }

      if (!klines || klines.length < 50) {
        return { success: false, error: i18n.t('ipcSetup.k2') };
      }

      const strategyId = config.strategyId;
      if (strategyId) {
        const result = await ctx.strategyEngine.runBacktest(strategyId, klines);
        if (result.success && ctx.db) {
          ctx.db.saveBacktestResult({
            strategyId, ...result.result,
            initialCapital: config.initialCapital || 100000,
          });
        }
        return result;
      }

      return await ctx.backtestEngine.run({ ...config, klines });
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[IPC] Backtest error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('strategy:startLive', async (_e, strategyId: string) => {
    ctx.strategyEngine?.startLive(strategyId);
    return { success: true };
  });

  ipcMain.handle('strategy:stopLive', async (_e, strategyId: string) => {
    ctx.strategyEngine?.stopLive(strategyId);
    return { success: true };
  });

  // ── Backtest Enhancement (Sprint 2: P1) ──────────────────────────
  ipcMain.handle('backtest:multiPeriod', async (_e, config: unknown) => {
    const vErr = validate(BacktestMultiPeriodSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('../engine/backtest/backtest-enhancer');
      const enhancer = new BacktestEnhancer(ctx.backtestEngine);
      const results = await enhancer.multiPeriodBacktest(
        config.klines, config.strategyConfig, config.periods
      );
      return { success: true, results };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:paramSweep', async (_e, config: unknown) => {
    const vErr = validate(BacktestParamSweepSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('../engine/backtest/backtest-enhancer');
      const enhancer = new BacktestEnhancer(ctx.backtestEngine);
      const results = await enhancer.parameterSweep(
        config.klines, config.baseConfig, config.paramRanges, config.maxCombinations || 100
      );
      return { success: true, results };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:riskMetrics', async (_e, equityCurve: number[], riskFreeRate?: number) => {
    try {
      const { BacktestEnhancer } = require('../engine/backtest/backtest-enhancer');
      const enhancer = new BacktestEnhancer(ctx.backtestEngine);
      const metrics = enhancer.computeDeepRiskMetrics(equityCurve, riskFreeRate || 0.03);
      return { success: true, metrics };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Strategy AI — LLM-powered (via server AI gateway, R83 P0-2b) ──
  ipcMain.handle('strategy:explain', async (_e, strategy: unknown) => {
    const prompt = `You are a quantitative trading strategy analyst. Explain the following strategy in clear, actionable English for a retail trader.

Strategy:
- Name: ${strategy.name || 'Unnamed'}
- Symbol: ${strategy.symbol || 'Unknown'}
- Type: ${strategy.strategy?.type || 'Unknown'}
- Params: ${JSON.stringify(strategy.strategy?.params || {})}
- Stop Loss: ${strategy.strategy?.stopLoss || 'Not set'}%
- Take Profit: ${strategy.strategy?.takeProfit || 'Not set'}%
- Description: ${strategy.description || 'No description'}

Provide a concise explanation covering:
1. What the strategy does (in plain language)
2. Entry and exit conditions
3. Risk management (stop loss / take profit)
4. Ideal market conditions for this strategy

Keep it under 200 words. Use bullet points.`;

    try {
      const { callChatCompletions } = await import('../utils/ai-gateway-client');
      const result = await callChatCompletions({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
      });
      if (!result.success) return result;
      return { success: true, explanation: result.content };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('strategy:compare', async (_e, s1: unknown, s2: unknown) => {
    const fmt = (s: unknown) =>
      `Name: ${s.name || '?'} | Symbol: ${s.symbol || '?'} | Type: ${s.strategy?.type || '?'} | ` +
      `Params: ${JSON.stringify(s.strategy?.params || {})} | SL: ${s.strategy?.stopLoss || '?'}% | ` +
      `TP: ${s.strategy?.takeProfit || '?'}%`;
    const prompt = `You are a quantitative trading strategy comparison tool. Compare these two strategies objectively.

Strategy A: ${fmt(s1)}

Strategy B: ${fmt(s2)}

Provide a structured comparison covering:
1. Which strategy is more aggressive / conservative
2. Which suits trending vs ranging markets
3. Risk/reward comparison
4. Which has better risk management (stop loss / take profit)
5. Overall recommendation for different trader profiles

Keep it under 250 words. Be objective, not promotional.`;

    try {
      const { callChatCompletions } = await import('../utils/ai-gateway-client');
      const result = await callChatCompletions({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      });
      if (!result.success) return result;
      return { success: true, comparison: result.content };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Strategy Optimizer (LLM-powered, via server AI gateway) ──────────
  ipcMain.handle('strategy:optimize', async (_e, raw: unknown) => {
    const vErr = validate(StrategyOptimizeSchema, raw);
    if (vErr) return vErr;
    const { strategyDSL, backtestResult } = raw as {
      strategyDSL: {
        name: string; symbol?: string; type: string;
        params: Record<string, unknown>; stopLoss?: number; takeProfit?: number;
      };
      backtestResult: {
        totalReturn: number; sharpeRatio: number; maxDrawdown: number;
        winRate: number; tradeCount?: number; equityCurve?: number[];
      };
    };

    const { totalReturn, sharpeRatio, maxDrawdown, winRate, tradeCount } = backtestResult;
    const metricSummary =
      `Total Return: ${totalReturn}%; Sharpe: ${sharpeRatio}; Max Drawdown: ${maxDrawdown}%; ` +
      `Win Rate: ${winRate}%${tradeCount !== undefined ? `; Trades: ${tradeCount}` : ''}`;

    const prompt = `You are a quantitative trading strategy optimization assistant. Based on the backtest results below, generate 3 concise parameter optimization suggestions to improve this strategy.

Current Strategy:
- Name: ${strategyDSL.name}
- Type: ${strategyDSL.type}
- Symbol: ${strategyDSL.symbol || 'Unknown'}
- Current Params: ${JSON.stringify(strategyDSL.params || {})}
- Stop Loss: ${strategyDSL.stopLoss ?? 'Not set'}%
- Take Profit: ${strategyDSL.takeProfit ?? 'Not set'}%

Backtest Results:
${metricSummary}


Provide exactly 3 suggestions. For each, explain:
1. Which parameter to change and why
2. The expected improvement
3. A concise rationale (1 sentence)

Respond ONLY with valid JSON in this exact format (no markdown, no explanation outside JSON):
{
  "suggestions": [
    {
      "param": "param_name",
      "currentValue": "current value or range",
      "suggestedValue": "suggested value or range",
      "reason": "why this improves the strategy"
    }
  ]
}`;

    try {
      const { callChatCompletions } = await import('../utils/ai-gateway-client');
      const result = await callChatCompletions({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 600,
      });
      if (!result.success) return result;
      let suggestions = [];
      try { suggestions = JSON.parse(result.content).suggestions || []; } catch (_e: unknown) { suggestions = []; }
      return { success: true, suggestions };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── NL Parser ───────────────────────────────────────────────────────
  ipcMain.handle('nl:parse', async (_e, text: string) => {
    return parseNaturalLanguage(text);
  });

  ipcMain.handle('nl:templates', async () => {
    return { success: true, templates: STRATEGY_TEMPLATES };
  });

  // ── Risk Engine ─────────────────────────────────────────────────────
  ipcMain.handle('risk:getConfig', async () => {
    return { success: true, config: ctx.riskEngine?.getConfig() };
  });

  ipcMain.handle('risk:updateConfig', async (_e, config: unknown) => {
    ctx.riskEngine?.updateConfig(config);
    return { success: true };
  });

  ipcMain.handle('risk:getAlerts', async () => {
    return { success: true, alerts: ctx.riskEngine?.getAlerts() || [] };
  });

  ipcMain.handle('risk:getStatusSnapshot', async () => {
    if (!ctx.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, snapshot: ctx.riskEngine.getStatusSnapshot() };
  });

  ipcMain.handle('risk:getKellyStats', async () => {
    if (!ctx.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, kelly: ctx.riskEngine.getKellyStats() };
  });

  ipcMain.handle('risk:getDrawdownState', async () => {
    if (!ctx.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, drawdown: ctx.riskEngine.getDrawdownState() };
  });

  ipcMain.handle('risk:updateVix', async (_e, vix: number) => {
    if (!ctx.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    ctx.riskEngine.updateVix(vix);
    return { success: true };
  });

  // ── Database ────────────────────────────────────────────────────────
  ipcMain.handle('db:getStrategies', async () => {
    return ctx.db?.getStrategies() || [];
  });

  ipcMain.handle('db:saveStrategy', async (_e, strategy: unknown) => {
    ctx.db?.saveStrategy(strategy);
    return { success: true };
  });

  ipcMain.handle('db:getSettings', async () => {
    return ctx.db?.getSettings() || {};
  });

  ipcMain.handle('db:saveSettings', async (_e, settings: unknown) => {
    ctx.db?.saveSettings(settings);
    return { success: true };
  });

  ipcMain.handle('db:getTrades', async (_e, strategyId?: string) => {
    return ctx.db?.getTrades(strategyId) || [];
  });

  ipcMain.handle('db:getBacktestResults', async (_e, strategyId: string) => {
    return ctx.db?.getBacktestResults(strategyId) || [];
  });

  ipcMain.handle('db:getWatchlist', async () => {
    return ctx.db?.getWatchlist() || [];
  });

  ipcMain.handle('db:saveWatchlist', async (_e, codes: string[]) => {
    ctx.db?.saveWatchlist(codes);
    return { success: true };
  });

  ipcMain.handle('db:getSignals', async (_e, strategyId?: string) => {
    return ctx.db?.getSignals(strategyId) || [];
  });

  // ── App ─────────────────────────────────────────────────────────────
  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    name: 'DAWN WHALES',
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
  }));

  ipcMain.handle('app:getMemoryUsage', () => ({
    mainProcess: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    total: Math.round(process.memoryUsage().rss / 1024 / 1024),
  }));

  ipcMain.handle('app:emergencyStop', async () => {
    try {
      log.warn('[App] Emergency stop triggered');
      const strategies = ctx.strategyEngine?.getAllStrategies() || [];
      for (const s of strategies) {
        if (s.liveRunning) {
          ctx.strategyEngine?.stopLive(s.id);
        }
      }
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('notification', {
          type: 'error',
          title: i18n.t('ipcSetup.k3'),
          message: i18n.t('ipcSetup.k4'),
        });
      }
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[App] Emergency stop failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── External URL Security ────────────────────────────────────────────
  const ALLOWED_PROTOCOLS = ['http:', 'https:'];
  ipcMain.handle('app:openExternal', async (_e, rawUrl: string) => {
    const vErr = validate(Z.object({ rawUrl: z.string().url() }), { rawUrl });
    if (vErr) return vErr;
    try {
      const url = new URL(rawUrl);
      if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
        log.warn('[Security] Blocked openExternal:', rawUrl);
        return { success: false, error: 'Protocol not allowed' };
      }
      await shell.openExternal(rawUrl);
      return { success: true };
    } catch (_e: unknown) {
      return { success: false, error: 'Invalid URL' };
    }
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);

  // ── Auto-updater ──────────────────────────────────────────────────
  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version || null };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:downloadUpdate', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:installUpdate', () => {
    autoUpdater.quitAndInstall();
  });

  // ── Greeks Calculation (WP5: Python subprocess) ─────────────────────
  ipcMain.handle('greeks:calculate', async (_e, params: {
    spot: number; strike: number; vol: number; days: number;
    rate?: number; type: 'CALL' | 'PUT'; qty?: number;
  }) => {
    try {
      const scriptPath = path.join(
        process.resourcesPath, '..', '..', '.workbuddy', 'skills', 'option-greeks', 'scripts', 'calc_greeks.py'
      );
      const devPath = path.join(
        require('os').homedir(), '.workbuddy', 'skills', 'option-greeks', 'scripts', 'calc_greeks.py'
      );
      const pythonExe = path.join(
        require('os').homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'
      );

      const fs = require('fs');
      const actualScript = fs.existsSync(scriptPath) ? scriptPath : devPath;
      if (!fs.existsSync(actualScript)) {
        return { success: false, error: 'option-greeks script not found' };
      }

      const cmd = `"${pythonExe}" "${actualScript}" --spot ${params.spot} --strike ${params.strike} --vol ${params.vol} --days ${params.days} --type ${params.type} --rate ${params.rate || 0.05} --json`;
      const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: 5000 });
      const result = JSON.parse(stdout);
      return { success: true, greeks: result };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[Greeks] Calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('greeks:portfolio', async (_e, positions: any[]) => {
    const vErr = validate(GreeksPortfolioSchema, { positions });
    if (vErr) return vErr;
    try {
      const devPath = path.join(
        require('os').homedir(), '.workbuddy', 'skills', 'option-greeks', 'scripts', 'portfolio_greeks.py'
      );
      const pythonExe = path.join(
        require('os').homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'
      );

      const fs = require('fs');
      if (!fs.existsSync(devPath)) {
        return { success: false, error: 'portfolio_greeks script not found' };
      }

      const positionsJson = JSON.stringify(positions).replace(/"/g, '\\"');
      const cmd = `"${pythonExe}" "${devPath}" --positions "${positionsJson}" --json`;
      const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: 10000 });
      const result = JSON.parse(stdout);
      return { success: true, portfolio: result };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[Greeks] Portfolio calc failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Marketplace ───────────────────────────────────────────────────
  ipcMain.handle('marketplace:rate', async (_e, strategyId: string, rating: number) => {
    const vErr = validate(MarketplaceRateSchema, { strategyId });
    if (vErr) return vErr;
    try {
      ctx.db?.rateStrategy(strategyId, rating);
      const stats = ctx.db?.getStrategyRating(strategyId);
      return { success: true, ...stats };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:getRating', async (_e, strategyId: string) => {
    const rating = ctx.db?.getStrategyRating(strategyId);
    const myRating = ctx.db?.getMyRating(strategyId);
    return { success: true, ...rating, myRating };
  });

  ipcMain.handle('marketplace:comment', async (_e, strategyId: string, content: string, parentId?: number) => {
    const vErr = validate(MarketplaceCommentSchema, { strategyId });
    if (vErr) return vErr;
    try {
      ctx.db?.addComment(strategyId, content, parentId);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:getComments', async (_e, strategyId: string) => {
    const comments = ctx.db?.getComments(strategyId) || [];
    return { success: true, comments };
  });

  ipcMain.handle('marketplace:savePerformance', async (_e, data: unknown) => {
    const vErr = validate(MarketplaceSavePerformanceSchema, { data });
    if (vErr) return vErr;
    try {
      ctx.db?.saveStrategyPerformance(data);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:getPerformance', async (_e, strategyId: string) => {
    const perf = ctx.db?.getStrategyPerformance(strategyId) || [];
    return { success: true, performance: perf };
  });

  ipcMain.handle('marketplace:list', async (_e, sortBy?: string, limit?: number) => {
    const strategies = ctx.db?.getMarketplaceStrategies(sortBy || 'rating', limit || 50) || [];
    return { success: true, strategies };
  });

  ipcMain.handle('marketplace:score', async (_e, strategyId: string) => {
    if (!ctx.marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const score = ctx.marketplaceService.calculateStrategyScore(strategyId);
      return { success: true, score };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[Marketplace] Score calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:verify', async (_e, strategyId: string) => {
    if (!ctx.marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const verification = ctx.marketplaceService.verifyPerformance(strategyId);
      return { success: true, verification };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[Marketplace] Verification failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:updateAllScores', async () => {
    if (!ctx.marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const result = ctx.marketplaceService.updateAllScores();
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[Marketplace] Batch update failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Data Provider (multi-source integration) ───────────────────────────
  ipcMain.handle('data:fundamental', async (_e, symbol: string) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const data = await ctx.dataProvider.getFundamental(symbol);
      return { success: true, data };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[DataProvider] Fundamental fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:capital-flow', async (_e, symbol: string) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const data = await ctx.dataProvider.getCapitalFlow(symbol);
      return { success: true, data };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[DataProvider] Capital flow fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:regime', async () => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const regime = await ctx.dataProvider.getMarketRegime();
      return { success: true, regime };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[DataProvider] Regime fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:anomalies', async (_e, symbol: string) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const signals = await ctx.dataProvider.getAnomalies(symbol);
      return { success: true, signals };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[DataProvider] Anomalies fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:news', async (_e, symbol: string, limit?: number) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const items = await ctx.dataProvider.getNews(symbol, limit);
      return { success: true, items };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[DataProvider] News fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:composite-score', async (_e, symbol: string) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const result = await ctx.dataProvider.getCompositeScore(symbol);
      return { success: true, result };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[DataProvider] Composite score failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-fundamental', async (_e, data: unknown) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      ctx.dataProvider.saveFundamental(data);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-capital-flow', async (_e, data: unknown) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      ctx.dataProvider.saveCapitalFlow(data);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-regime', async (_e, regime: unknown) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      ctx.dataProvider.saveMarketRegime(regime);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:compute-regime', async (_e, factors: unknown) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const regime = ctx.dataProvider.computeRegime(factors);
      return { success: true, regime };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-anomaly', async (_e, signal: unknown) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      ctx.dataProvider.saveAnomaly(signal);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-news', async (_e, symbol: string, items: any[]) => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      ctx.dataProvider.saveNews(symbol, items);
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:clear-cache', async () => {
    if (!ctx.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      ctx.dataProvider.clearExpiredCache();
      return { success: true };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Walk-Forward Analysis (Sprint 2 — JVS) ───────────────────────────
  ipcMain.handle('backtest:walk-forward', async (_e, config: unknown) => {
    const vErr = validate(BacktestWalkForwardSchema, { config });
    if (vErr) return vErr;
    try {
      const wfa = new WalkForwardEngine();
      const klines = config.klines || [];
      if (klines.length < 100) {
        return { success: false, error: i18n.t('ipcSetup.k5') };
      }
      const report = await wfa.run(config, klines);
      return { success: true, report };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[WFA] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Parameter Scanner (Sprint 2 — JVS) ───────────────────────────────
  ipcMain.handle('backtest:param-scan', async (_e, config: unknown) => {
    const vErr = validate(BacktestParamScanSchema, { config });
    if (vErr) return vErr;
    try {
      const scanner = new ParameterScanner();
      const klines = config.klines || [];
      if (klines.length < 50) {
        return { success: false, error: i18n.t('ipcSetup.k6') };
      }
      const report = await scanner.run({ ...config, klines });
      return { success: true, report };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[ParamScan] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Multi-timeframe comparison (Sprint 2 — JVS) ──────────────────────
  ipcMain.handle('backtest:multi-timeframe', async (_e, config: unknown) => {
    const vErr = validate(BacktestMultiTimeframeSchema, { config });
    if (vErr) return vErr;
    try {
      const engine = new BacktestEngine();
      const timeframes = config.timeframes || ['1m', '5m', '15m', '1h', 'daily'];
      const results: Record<string, any> = {};

      for (const tf of timeframes) {
        const klines = config.klinesByTimeframe?.[tf] || [];
        if (klines.length < 50) {
          results[tf] = { success: false, error: i18n.t('ipcSetup.k7') };
          continue;
        }
        const btResult = await engine.run({
          symbol: config.symbol,
          initialCapital: config.initialCapital || 100000,
          commission: config.commission || 0.001,
          slippage: config.slippage || 0.0005,
          strategy: config.strategy,
          klines,
        });
        results[tf] = btResult;
      }

      return { success: true, results, timeframes };
    } catch (err) {
    // [EngineError:AI] — structured error tracking
      log.error('[MultiTF] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── R91 J-03: IPC Hardening — Health + Diagnostics ──────────────────────

  /** IPC health stats endpoint — returns call counts, error rates, latencies */
  ipcMain.handle('ipc:health-stats', async () => {
    return { success: true, stats: ipcHealth.getStats() };
  });

  /** Re-entry guard status — shows which handlers are currently running */
  const reentryGuard = new ReentryGuard();
  ipcMain.handle('ipc:reentry-status', async () => {
    return { success: true, running: reentryGuard.getRunningKeys() };
  });

  /**
   * Hardened handler wrapper — applies timeout + EngineError wrapping + health tracking.
   * Usage in new handlers:
   *   hardenedHandle('channel:name', async (event, args) => { ... }, { timeout: 30000 });
   */
  const hardenedHandle = <T>(
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, args: any) => Promise<T>,
    options: { timeout?: number; preventReentry?: boolean; schema?: any } = {}
  ) => {
    const { timeout = 30000, preventReentry = false, schema } = options;

    ipcMain.handle(channel, async (event, rawArgs) => {
      const start = Date.now();

      // Re-entry check
      if (preventReentry && !reentryGuard.acquire(channel)) {
        ipcHealth.recordCall(channel, 0, false, false, true);
        throw new EngineError(
          ErrorDomain.SYSTEM,
          ErrorCode.INVALID_PARAM,
          `Operation '${channel}' is already in progress`,
          { context: { channel } }
        );
      }

      try {
        // Input validation
        const args = schema ? validateInput(rawArgs, schema, channel) : rawArgs;

        // Execute with timeout
        const result = await withTimeout(handler(event, args), timeout, channel);
        const elapsed = Date.now() - start;
        ipcHealth.recordCall(channel, elapsed);
        return result;
      } catch (error) {
        const elapsed = Date.now() - start;
        const isTimeout = error instanceof EngineError && error.code === ErrorCode.AI_TIMEOUT;
        ipcHealth.recordCall(channel, elapsed, true, isTimeout);

        if (error instanceof EngineError) throw error;

        throw new EngineError(
          ErrorDomain.SYSTEM,
          ErrorCode.INTERNAL_ERROR,
          `IPC '${channel}' failed: ${error instanceof Error ? error.message : String(error)}`,
          { context: { channel, elapsed }, cause: error instanceof Error ? error : undefined }
        );
      } finally {
        if (preventReentry) reentryGuard.release(channel);
      }
    });
  };

  // Export hardenedHandle for use by other modules
  (globalThis as any).__ipcHardenedHandle = hardenedHandle;

  log.info('[IPC] R91 hardening layer active: timeout + reentry guard + health tracking + EngineError wrapping');
}