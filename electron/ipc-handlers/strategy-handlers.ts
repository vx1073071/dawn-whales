// ── IPC Handlers — Strategy & Backtest ──────────────────────────────────────
// 所有 strategy:* 和 backtest:* 相关的 IPC handlers
// 从 main.ts 拆分出来，约20个 handlers

import { ipcMain } from 'electron';
import { shared, validate } from './_import-shared';
import log from 'electron-log';
import {
  StrategyCreateSchema,
  StrategyUpdateSchema,
  StrategyGetSchema,
  StrategyBacktestSchema,
  StrategyExplainSchema,
  StrategyCompareSchema,
  BacktestMultiPeriodSchema,
  BacktestParamSweepSchema,
  BacktestRiskMetricsSchema,
  BacktestWalkForwardSchema,
  BacktestParamScanSchema,
  BacktestMultiTimeframeSchema,
} from '../ipc-schemas';
import { WalkForwardEngine } from '../engine/walk-forward';
import { ParameterScanner } from '../engine/parameter-scanner';

// Strategy update field whitelist for security
const STRATEGY_UPDATE_WHITELIST = ['name', 'description', 'params', 'stopLoss', 'takeProfit', 'symbol'];

export function registerStrategyHandlers() {
  // ── Strategy Engine ─────────────────────────────────────────────────
  ipcMain.handle('strategy:create', async (_e, dsl: any) => {
    const vErr = validate(StrategyCreateSchema, { dsl });
    if (vErr) return vErr;
    try {
      const id = shared.strategyEngine?.createStrategy(dsl);
      const strategy = shared.strategyEngine?.getStrategy(id!);
      if (strategy && shared.db) shared.db.saveStrategy(strategy);
      return { success: true, id, strategy };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('strategy:getAll', async () => {
    return { success: true, strategies: shared.strategyEngine?.getAllStrategies() || [] };
  });

  ipcMain.handle('strategy:get', async (_e, id: string) => {
    const vErr = validate(StrategyGetSchema, { id });
    if (vErr) return vErr;
    const strategy = shared.strategyEngine?.getStrategy(id);
    return { success: !!strategy, strategy };
  });

  // ── Strategy Update (with field whitelist for security) ─────────────
  ipcMain.handle('strategy:update', async (_e, id: string, updates: any) => {
    const vErr = validate(StrategyUpdateSchema, { updates });
    if (vErr) return vErr;
    try {
      const strategy = shared.strategyEngine?.getStrategy(id);
      if (!strategy) return { success: false, error: 'Strategy not found' };
      // Security: only allow whitelisted fields
      const sanitized: any = {};
      for (const key of STRATEGY_UPDATE_WHITELIST) {
        if (key in updates) sanitized[key] = updates[key];
      }
      Object.assign(strategy, sanitized, { updatedAt: new Date().toISOString() });
      if (shared.db) shared.db.saveStrategy(strategy);
      return { success: true, strategy };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('strategy:delete', async (_e, id: string) => {
    shared.strategyEngine?.deleteStrategy(id);
    shared.db?.deleteStrategy(id);
    return { success: true };
  });

  ipcMain.handle('strategy:backtest', async (_e, config: any) => {
    const vErr = validate(StrategyBacktestSchema, config);
    if (vErr) return vErr;
    
    if (!shared.strategyEngine || !shared.backtestEngine) {
      return { success: false, error: 'Engine not ready' };
    }
    try {
      // Fetch K-lines
      let klines = config.klines;
      if (!klines || klines.length === 0) {
        // Try cache first
        klines = shared.db?.getKlines(config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200);
        if (!klines || klines.length === 0) {
          if (shared.opendClient?.connected) {
            klines = await shared.opendClient.getKlines(config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200);
            if (klines.length > 0 && shared.db) shared.db.saveKlines(config.symbol || 'US.TQQQ', config.period || 'daily', klines);
          }
        }
      }

      if (!klines || klines.length < 50) {
        return { success: false, error: 'K线数据不足（需要至少50根），请确认 OpenD 已连接' };
      }

      const strategyId = config.strategyId;
      if (strategyId) {
        const result = await shared.strategyEngine.runBacktest(strategyId, klines);
        if (result.success && shared.db) {
          shared.db.saveBacktestResult({
            strategyId, ...result.result,
            initialCapital: config.initialCapital || 100000,
          });
        }
        return result;
      }

      return await shared.backtestEngine.run({ ...config, klines });
    } catch (err: any) {
      log.error('[IPC] Backtest error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('strategy:startLive', async (_e, strategyId: string) => {
    shared.strategyEngine?.startLive(strategyId);
    return { success: true };
  });

  ipcMain.handle('strategy:stopLive', async (_e, strategyId: string) => {
    shared.strategyEngine?.stopLive(strategyId);
    return { success: true };
  });

  // ── Strategy AI — LLM-powered (Sprint 2 P1) ─────────────────────
  ipcMain.handle('strategy:explain', async (_e, strategy: any) => {
    const vErr = validate(StrategyExplainSchema, { strategy });
    if (vErr) return vErr;
    
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Set DEEPSEEK_API_KEY env var.' };
    }
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
      const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 400 });
      const result = await new Promise<any>((resolve, reject) => {
        const req = require('https').request(
          { hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } },
          (res: any) => { let data = ''; res.on('data', (c: string) => data += c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); }
        );
        req.on('error', reject); req.write(body); req.end();
      });
      const content = result.choices?.[0]?.message?.content || '';
      return { success: true, explanation: content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('strategy:compare', async (_e, s1: any, s2: any) => {
    const vErr = validate(StrategyCompareSchema, { s1, s2 });
    if (vErr) return vErr;
    
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Set DEEPSEEK_API_KEY env var.' };
    }
    const fmt = (s: any) => `Name: ${s.name || '?'} | Symbol: ${s.symbol || '?'} | Type: ${s.strategy?.type || '?'} | Params: ${JSON.stringify(s.strategy?.params || {})} | SL: ${s.strategy?.stopLoss || '?'}% | TP: ${s.strategy?.takeProfit || '?'}%`;
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
      const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 500 });
      const result = await new Promise<any>((resolve, reject) => {
        const req = require('https').request(
          { hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } },
          (res: any) => { let data = ''; res.on('data', (c: string) => data += c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); }
        );
        req.on('error', reject); req.write(body); req.end();
      });
      const content = result.choices?.[0]?.message?.content || '';
      return { success: true, comparison: content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Backtest Enhancement (Sprint 2: P1) ──────────────────────────

  ipcMain.handle('backtest:multiPeriod', async (_e, config: any) => {
    const vErr = validate(BacktestMultiPeriodSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('../engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(shared.backtestEngine);
      const results = await enhancer.multiPeriodBacktest(
        config.klines, config.strategyConfig, config.periods
      );
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:paramSweep', async (_e, config: any) => {
    const vErr = validate(BacktestParamSweepSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('../engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(shared.backtestEngine);
      const results = await enhancer.parameterSweep(
        config.klines, config.baseConfig, config.paramRanges, config.maxCombinations || 100
      );
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:riskMetrics', async (_e, equityCurve: number[], riskFreeRate?: number) => {
    const vErr = validate(BacktestRiskMetricsSchema, { equityCurve, riskFreeRate });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('../engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(shared.backtestEngine);
      const metrics = enhancer.computeDeepRiskMetrics(equityCurve, riskFreeRate || 0.03);
      return { success: true, metrics };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Walk-Forward Analysis (Sprint 2 — JVS) ───────────────────────────
  ipcMain.handle('backtest:walk-forward', async (_e, config: any) => {
    const vErr = validate(BacktestWalkForwardSchema, { config });
    if (vErr) return vErr;
    try {
      const wfa = new WalkForwardEngine();
      const klines = config.klines || [];
      if (klines.length < 100) {
        return { success: false, error: 'K线数据不足 (需至少100根)' };
      }
      const report = await wfa.run(config, klines);
      return { success: true, report };
    } catch (err: any) {
      log.error('[WFA] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Parameter Scanner (Sprint 2 — JVS) ───────────────────────────────
  ipcMain.handle('backtest:param-scan', async (_e, config: any) => {
    const vErr = validate(BacktestParamScanSchema, { config });
    if (vErr) return vErr;
    try {
      const scanner = new ParameterScanner();
      const klines = config.klines || [];
      if (klines.length < 50) {
        return { success: false, error: 'K线数据不足 (需至少50根)' };
      }
      const report = await scanner.run({ ...config, klines });
      return { success: true, report };
    } catch (err: any) {
      log.error('[ParamScan] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Multi-timeframe comparison (Sprint 2 — JVS) ──────────────────────
  ipcMain.handle('backtest:multi-timeframe', async (_e, config: any) => {
    const vErr = validate(BacktestMultiTimeframeSchema, { config });
    if (vErr) return vErr;
    try {
      const engine = new shared.BacktestEngine!();
      const timeframes = config.timeframes || ['1m', '5m', '15m', '1h', 'daily'];
      const results: Record<string, any> = {};

      for (const tf of timeframes) {
        const klines = config.klinesByTimeframe?.[tf] || [];
        if (klines.length < 50) {
          results[tf] = { success: false, error: 'K线不足' };
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
    } catch (err: any) {
      log.error('[MultiTF] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });
}
