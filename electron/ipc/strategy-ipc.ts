// ── DAWN WHALES IPC: strategy ────────────────────────────────────────────
// Auto-split from main.ts — 38 handlers
//
// Registered channels:
//   strategy:create
//   strategy:getAll
//   strategy:get
//   strategy:update
//   strategy:delete
//   strategy:backtest
//   strategy:startLive
//   strategy:stopLive
//   strategy:explain
//   strategy:compare
//   strategy:optimize
//   strategy:correlation
//   strategy:auto-tune
//   strategy:correlation-viz
//   paper:start
//   paper:stop
//   paper:reset
//   paper:report
//   paper:execute-signal
//   paper:status
//   strategy:templates
//   paper:start
//   paper:stop
//   paper:reset
//   paper:report
//   paper:submit-order
//   strategy:multi-factor
//   strategy:compare
//   nl:parse
//   nl:templates
//   strategy:correlation
//   live:start
//   live:stop
//   live:add-strategy
//   live:remove-strategy
//   live:get-status
//   live:get-positions
//   live:get-orders

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { STRATEGY_TEMPLATES, parseNaturalLanguage } from './engine/nl-parser';
import { LiveExecutor } from './engine/live-executor';
import { computeCorrelationMatrix } from './engine/correlation-matrix';
import { autoTune } from './engine/auto-tuner';
import { buildCorrelationVisualization } from './engine/correlation-visualizer';
import { compareBacktests, summaryTable } from './engine/backtest-comparator';

/**
 * Register all strategy IPC handlers
 *
 * @param strategyEngine - service reference
 * @param db - service reference
 * @param opendClient - service reference
 * @param backtestEngine - service reference
 * @param getDeepSeekKey_ - service reference
 * @param liveExecutor - service reference
 */
export function registerStrategyIPC(
  strategyEngine: any,
  db: any,
  opendClient: any,
  backtestEngine: any,
  getDeepSeekKey_: any,
  liveExecutor: any
) {

  // ── strategy:create ───────────────────────────────────────────────
  // ── Strategy Engine ─────────────────────────────────────────────────
  ipcMain.handle('strategy:create', async (_e, dsl: any) => {
    const vErr = validate(StrategyCreateSchema, { dsl });
    if (vErr) return vErr;
    try {
      const id = strategyEngine?.createStrategy(dsl);
      const strategy = strategyEngine?.getStrategy(id!);
      if (strategy && db) db.saveStrategy(strategy);
      return { success: true, id, strategy };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── strategy:getAll ───────────────────────────────────────────────
  ipcMain.handle('strategy:getAll', async () => {
    return { success: true, strategies: strategyEngine?.getAllStrategies() || [] };
  });

  // ── strategy:get ───────────────────────────────────────────────
  ipcMain.handle('strategy:get', async (_e, id: string) => {
    const strategy = strategyEngine?.getStrategy(id);
    return { success: !!strategy, strategy };
  });

  // ── strategy:update ───────────────────────────────────────────────
  ipcMain.handle('strategy:update', async (_e, id: string, updates: any) => {
    const vErr = validate(StrategyUpdateSchema, { updates });
    if (vErr) return vErr;
    try {
      const strategy = strategyEngine?.getStrategy(id);
      if (!strategy) return { success: false, error: 'Strategy not found' };
      // Security: only allow whitelisted fields
      const sanitized: any = {};
      for (const key of STRATEGY_UPDATE_WHITELIST) {
        if (key in updates) sanitized[key] = updates[key];
      }
      Object.assign(strategy, sanitized, { updatedAt: new Date().toISOString() });
      if (db) db.saveStrategy(strategy);
      return { success: true, strategy };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── strategy:delete ───────────────────────────────────────────────
  ipcMain.handle('strategy:delete', async (_e, id: string) => {
    strategyEngine?.deleteStrategy(id);
    db?.deleteStrategy(id);
    return { success: true };
  });

  // ── strategy:backtest ───────────────────────────────────────────────
  ipcMain.handle('strategy:backtest', async (_e, config: any) => {
    if (!strategyEngine || !backtestEngine) {
      return { success: false, error: 'Engine not ready' };
    }
    try {
      // Fetch K-lines
      let klines = config.klines;
      if (!klines || klines.length === 0) {
        // Try cache first
        klines = db?.getKlines(config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200);
        if (!klines || klines.length === 0) {
          if (opendClient?.connected) {
            klines = await opendClient.getKlines(config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200);
            if (klines.length > 0 && db) db.saveKlines(config.symbol || 'US.TQQQ', config.period || 'daily', klines);
          }
        }
      }

      if (!klines || klines.length < 50) {
        return { success: false, error: 'K线数据不足（需要至少50根），请确认 OpenD 已连接' };
      }

      const strategyId = config.strategyId;
      if (strategyId) {
        const result = await strategyEngine.runBacktest(strategyId, klines);
        if (result.success && db) {
          db.saveBacktestResult({
            strategyId, ...result.result,
            initialCapital: config.initialCapital || 100000,
          });
        }
        return result;
      }

      return await backtestEngine.run({ ...config, klines });
    } catch (err: any) {
      log.error('[IPC] Backtest error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── strategy:startLive ───────────────────────────────────────────────
  ipcMain.handle('strategy:startLive', async (_e, strategyId: string) => {
    strategyEngine?.startLive(strategyId);
    return { success: true };
  });

  // ── strategy:stopLive ───────────────────────────────────────────────
  ipcMain.handle('strategy:stopLive', async (_e, strategyId: string) => {
    strategyEngine?.stopLive(strategyId);
    return { success: true };
  });

  // ── strategy:explain ───────────────────────────────────────────────
  // ── Strategy AI — LLM-powered (Sprint 2 P1) ─────────────────────
  ipcMain.handle('strategy:explain', async (_e, strategy: any) => {
    const apiKey = getDeepSeekKey_(app);
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Use Settings to set your key.' };
    }
    const prompt = `You are a quantitative trading strategy analyst. Explain the following strategy in clear, actionable English for a retail trader.

  Strategy:
  - Name: ${strategy.name || 'Unnamed'}
  - Symbol: ${strategy.symbol || 'Unknown'}
  - Type: ${strategy.strategy?.type || 'Unknown'}
  - Params: ${JSON.stringify(strategy.strategy?.params || {})}}

  // ── strategy:compare ───────────────────────────────────────────────
  ipcMain.handle('strategy:compare', async (_e, s1: any, s2: any) => {
    const apiKey = getDeepSeekKey_(app);
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Use Settings to set your key.' };
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

  // ── strategy:optimize ───────────────────────────────────────────────
  // ── Strategy Optimizer (LLM-powered) ─────────────────────────────────
  ipcMain.handle('strategy:optimize', async (_e, raw: unknown) => {
    const vErr = validate(StrategyOptimizeSchema, raw);
    if (vErr) return vErr;
    const { strategyDSL, backtestResult } = raw as {
      strategyDSL: { name: string; symbol?: string; type: string; params: Record<string, unknown>; stopLoss?: number; takeProfit?: number };
      backtestResult: { totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number; tradeCount?: number; equityCurve?: number[] };
    };
    const apiKey = getDeepSeekKey_(app);
    if (!apiKey) return { success: false, error: 'DeepSeek API key not configured. Use Settings to set your key.' };


    const { totalReturn, sharpeRatio, maxDrawdown, winRate, tradeCount } = backtestResult;
    const metricSummary = `Total Return: ${totalReturn}%; Sharpe: ${sharpeRatio}; Max Drawdown: ${maxDrawdown}%; Win Rate: ${winRate}%${tradeCount !== undefined ? `; Trades: ${tradeCount}` : ''}`;
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
      const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 600 });
      const result = await new Promise<any>((resolve, reject) => {
        const req = require('https').request(
          { hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } },
          (res: any) => { let data = ''; res.on('data', (c: string) => data += c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); }
        );
        req.on('error', reject); req.write(body); req.end();
      });
      const rawContent = result.choices?.[0]?.message?.content || '';
      let suggestions = [];
      try { suggestions = JSON.parse(rawContent).suggestions || []; } catch { suggestions = []; }
      return { success: true, suggestions };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── strategy:correlation ───────────────────────────────────────────────
  // ── Strategy Correlation Matrix ───────────────────────────────────────
  ipcMain.handle('strategy:correlation', async (_e, raw: unknown) => {
    const vErr = validate(StrategyCorrelationSchema, raw);
    if (vErr) return vErr;
    const { strategies } = raw as {
      strategies: { id: string; equityCurve: { time: number; value: number }[] }[];
    };
    if (strategies.length < 1) {
      return { success: false, error: 'At least 1 strategy required' };
    }
    const result = computeCorrelationMatrix(strategies);
    return { success: true, ...result };
  });

  // ── strategy:auto-tune ───────────────────────────────────────────────
  // ── Auto-Tuner ──────────────────────────────────────────────────────
  ipcMain.handle('strategy:auto-tune', async (_e, raw: unknown) => {
    const vErr = validate(StrategyAutoTuneSchema, raw);
    if (vErr) return vErr;
    const { strategyType, ranges, klines, method, populationSize, generations, iterations } = raw as {
      strategyType: string;
      ranges: ParamRange[];
      klines: any[];
      method?: 'ga' | 'bayesian' | 'both';
      populationSize?: number;
      generations?: number;
      iterations?: number;
    };
    log.info(`[IPC] strategy:auto-tune — type=${strategyType} method=${method ?? 'both'}`);
    const result = await autoTune(strategyType, ranges, klines, { method, populationSize, generations, iterations });
    return { success: true, result };
  });

  // ── strategy:correlation-viz ───────────────────────────────────────────────
  // ── Q11: Correlation Visualizer ────────────────────────────────────
  ipcMain.handle('strategy:correlation-viz', async (_e, raw: unknown) => {
    try {
      const { buildCorrelationVisualization } = require('./engine/correlation-visualizer');
      const { inputs } = raw as { inputs: Array<{ id: string; equityCurve: Array<{ time: number; value: number }> }> };
      if (!inputs || inputs.length < 2) {
        return { success: false, error: 'At least 2 strategies required for correlation visualization' };
      }
      const result = buildCorrelationVisualization(inputs);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── paper:start ───────────────────────────────────────────────
  // ── Q17: Paper Trader ─────────────────────────────────────────
  ipcMain.handle('paper:start', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const pt = getPaperTrader('default');
      return { success: true, status: pt.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── paper:stop ───────────────────────────────────────────────
  ipcMain.handle('paper:stop', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const pt = getPaperTrader('default');
      pt.stopAll();
      return { success: true, report: pt.getReport() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── paper:reset ───────────────────────────────────────────────
  ipcMain.handle('paper:reset', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      getPaperTrader('default').reset();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── paper:report ───────────────────────────────────────────────
  ipcMain.handle('paper:report', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const pt = getPaperTrader('default');
      const report = pt.getReport();
      return { success: true, ...report };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── paper:execute-signal ───────────────────────────────────────────────
  ipcMain.handle('paper:execute-signal', async (_e, raw: unknown) => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const signal = raw as any;
      const pt = getPaperTrader('default');
      const trade = pt.executeSignal(signal, signal.name);
      return { success: !!trade, trade };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── paper:status ───────────────────────────────────────────────
  ipcMain.handle('paper:status', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      return { success: true, status: getPaperTrader('default').getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── strategy:templates ───────────────────────────────────────────────
  // ── Q18: Strategy Templates ─────────────────────────────────
  ipcMain.handle('strategy:templates', async (_e, raw: unknown) => {
    try {
      const { getAllTemplates, getTemplate, getTemplatesByCategory, searchTemplates, instantiateTemplate } =
        require('./engine/strategy-templates');
      const req = raw as { action?: string; id?: string; category?: string; query?: string; overrides?: any };
      const action = req?.action ?? 'list';
      if (action === 'list') return { success: true, templates: getAllTemplates() };
      if (action === 'get') {
        if (!req.id) return { success: false, error: 'id required' };
        const t = getTemplate(req.id);
        return { success: !!t, template: t };
      }
      if (action === 'category') {
        if (!req.category) return { success: false, error: 'category required' };
        return { success: true, templates: getTemplatesByCategory(req.category) };
      }
      if (action === 'search') {
        if (!req.query) return { success: false, error: 'query required' };
        return { success: true, templates: searchTemplates(req.query) };
      }
      if (action === 'instantiate') {
        if (!req.id) return { success: false, error: 'id required' };
        const { strategy, error } = instantiateTemplate(req.id, req.overrides ?? {});
        return { success: !error, strategy, error };
      }
      return { success: false, error: 'Unknown action' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── paper:start ───────────────────────────────────────────────
  ipcMain.handle('paper:start', async (_e, symbols?: string[]) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      pt.start(symbols);

      return { success: true, status: pt.getAccount() };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── paper:stop ───────────────────────────────────────────────
  ipcMain.handle('paper:stop', async () => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      getPaperTrader('default').stop();

      return { success: true };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── paper:reset ───────────────────────────────────────────────
  ipcMain.handle('paper:reset', async () => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      getPaperTrader('default').reset();

      return { success: true };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── paper:report ───────────────────────────────────────────────
  ipcMain.handle('paper:report', async (_e, strategyId?: string) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      const report = pt.getReport(strategyId);

      return { success: true, ...report };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── paper:submit-order ───────────────────────────────────────────────
  ipcMain.handle('paper:submit-order', async (_e, raw: unknown) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      const order = raw as any;

      const orderId = pt.submitOrder(order);

      return { success: true, orderId };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── strategy:multi-factor ───────────────────────────────────────────────
  // ── Q15: Multi-Factor Model ─────────────────────────────────────
  ipcMain.handle('strategy:multi-factor', async (_e, raw: unknown) => {
    try {
      const { scoreStocks, scoreTopAStocks } = require('./engine/multi-factor');
      const req = raw as { stocks?: Array<{ code: string; name: string }>; preset?: string; limit?: number };
      if (req.limit != null) {
        // Top-A mode
        const result = await scoreTopAStocks(req.limit, req.preset as any);
        return { success: true, ...result };
      }
      if (!req.stocks || req.stocks.length === 0) {
        return { success: false, error: 'stocks array is required' };
      }
      const result = await scoreStocks(req as any);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── strategy:compare ───────────────────────────────────────────────
  // ── Q13: Backtest Comparator ──────────────────────────────────────
  ipcMain.handle('strategy:compare', async (_e, raw: unknown) => {
    try {
      const { compareBacktests, summaryTable } = require('./engine/backtest-comparator');
      const { results } = raw as { results: any[] };
      if (!results || results.length === 0) {
        return { success: false, error: 'At least one backtest result required' };
      }
      const comparison = compareBacktests(results);
      const table = summaryTable(results, comparison);
      return { success: true, comparison, table };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── nl:parse ───────────────────────────────────────────────
  // ── NL Parser ───────────────────────────────────────────────────────
  ipcMain.handle('nl:parse', async (_e, text: string) => {
    return parseNaturalLanguage(text);
  });

  // ── nl:templates ───────────────────────────────────────────────
  ipcMain.handle('nl:templates', async () => {
    return { success: true, templates: STRATEGY_TEMPLATES };
  });

  // ── strategy:correlation ───────────────────────────────────────────────
  // ── Correlation Matrix (Q2: QClaw) ──────────────────────────────────
  ipcMain.handle('strategy:correlation', async (_e, inputs: Array<{ id: string; equityCurve: Array<{ time: number; value: number }> }>) => {
    try {
      const { computeCorrelationMatrix } = require('./engine/correlation-matrix');
      const result = computeCorrelationMatrix(inputs);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── live:start ───────────────────────────────────────────────
  // ── Q14: Live Executor ──────────────────────────────────────────────
  ipcMain.handle('live:start', async (_e, symbols?: string[]) => {
    try {
      if (!liveExecutor) {
        return { success: false, error: 'LiveExecutor not initialized' };
      }
      liveExecutor.start(symbols);
      return { success: true, status: liveExecutor.getStatus() };
    } catch (err: any) {
      log.error('[live:start]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── live:stop ───────────────────────────────────────────────
  ipcMain.handle('live:stop', async () => {
    try {
      liveExecutor?.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── live:add-strategy ───────────────────────────────────────────────
  ipcMain.handle('live:add-strategy', async (_e, config: any) => {
    try {
      if (!liveExecutor) return { success: false, error: 'LiveExecutor not initialized' };
      const { strategyId, symbol, signalType, price, quantity, stopLoss, takeProfit } = config;
      if (!strategyId || !symbol) return { success: false, error: 'strategyId and symbol required' };
      liveExecutor.addStrategy({ strategyId, symbol, signalType: signalType || 'BUY', price, quantity, stopLoss, takeProfit });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── live:remove-strategy ───────────────────────────────────────────────
  ipcMain.handle('live:remove-strategy', async (_e, strategyId: string) => {
    try {
      liveExecutor?.removeStrategy(strategyId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── live:get-status ───────────────────────────────────────────────
  ipcMain.handle('live:get-status', async () => {
    return { success: true, status: liveExecutor?.getStatus() ?? null };
  });

  // ── live:get-positions ───────────────────────────────────────────────
  ipcMain.handle('live:get-positions', async () => {
    return { success: true, positions: liveExecutor?.getPositions() ?? [] };
  });

  // ── live:get-orders ───────────────────────────────────────────────
  ipcMain.handle('live:get-orders', async () => {
    return { success: true, orders: liveExecutor?.getOrders() ?? [] };
  });

}
