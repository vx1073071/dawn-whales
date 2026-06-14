// @ts-nocheck
// ── DAWN WHALES IPC: strategy ────────────────────────────────────────────
// 38 handlers — strategy/live/paper/nl domains

import { ipcMain, BrowserWindow, app } from "electron";
import log from "electron-log";
import i18n from '../i18n/main-i18n';
import { EngineError } from './engine/core/engine-error';


export function registerStrategyIPC(
  strategyEngine: unknown,
  db: unknown,
  opendClient: unknown,
  backtestEngine: unknown,
  liveExecutor: unknown) {



  // ── Strategy Engine ─────────────────────────────────────────────────
  ipcMain.handle('strategy:create', async (_e, dsl: unknown) => {
    const vErr = validate(StrategyCreateSchema, { dsl });
    if (vErr) return vErr;
    try {
      const id = strategyEngine?.createStrategy(dsl);
      const strategy = strategyEngine?.getStrategy(id!);
      if (strategy && db) db.saveStrategy(strategy);
      return { success: true, id, strategy };
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('strategy:getAll', async () => {
    return { success: true, strategies: strategyEngine?.getAllStrategies() || [] };
  });



  ipcMain.handle('strategy:get', async (_e, id: string) => {
    const strategy = strategyEngine?.getStrategy(id);
    return { success: !!strategy, strategy };
  });

  // ── Strategy Update (with field whitelist for security) ─────────────
  const STRATEGY_UPDATE_WHITELIST = ['name', 'description', 'params', 'stopLoss', 'takeProfit', 'symbol'];

  ipcMain.handle('strategy:update', async (_e, id: string, updates: unknown) => {
    const vErr = validate(StrategyUpdateSchema, { updates });
    if (vErr) return vErr;
    try {
      const strategy = strategyEngine?.getStrategy(id);
      if (!strategy) return { success: false, error: 'Strategy not found' };
      // Security: only allow whitelisted fields
      const sanitized: unknown = {};
      for (const key of STRATEGY_UPDATE_WHITELIST) {
        if (key in updates) sanitized[key] = updates[key];
      }
      Object.assign(strategy, sanitized, { updatedAt: new Date().toISOString() });
      if (db) db.saveStrategy(strategy);
      return { success: true, strategy };
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('strategy:delete', async (_e, id: string) => {
    strategyEngine?.deleteStrategy(id);
    db?.deleteStrategy(id);
    return { success: true };
  });



  ipcMain.handle('strategy:backtest', async (_e, config: unknown) => {
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
        return { success: false, error: i18n.t('strategyIpc.k1') };
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
    } catch (err) {
      log.error('[IPC] Backtest error:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('strategy:startLive', async (_e, strategyId: string) => {
    strategyEngine?.startLive(strategyId);
    return { success: true };
  });



  ipcMain.handle('strategy:stopLive', async (_e, strategyId: string) => {
    strategyEngine?.stopLive(strategyId);
    return { success: true };
  });

  // ── Backtest Enhancement (Sprint 2: P1) ──────────────────────────



  // ── Strategy AI — LLM-powered (Sprint 2 P1) ─────────────────────
  ipcMain.handle('strategy:explain', async (_e, strategy: unknown) => {
    const prompt = `You are a quantitative trading strategy analyst. Explain the following strategy in clear, actionable English for a retail trader.

Strategy:
- Name: ${strategy.name || 'Unnamed'}
- Symbol: ${strategy.symbol || 'Unknown'}
- Type: ${strategy.strategy?.type || 'Unknown'}
- Params: ${JSON.stringify(strategy.strategy?.params || {})}}
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
    const content = result.content;
      return { success: true, explanation: content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('strategy:compare', async (_e, s1: unknown, s2: unknown) => {
    const fmt = (s: unknown) => `Name: ${s.name || '?'} | Symbol: ${s.symbol || '?'} | Type: ${s.strategy?.type || '?'} | Params: ${JSON.stringify(s.strategy?.params || {})} | SL: ${s.strategy?.stopLoss || '?'}% | TP: ${s.strategy?.takeProfit || '?'}%`;
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
    const content = result.content;
      return { success: true, comparison: content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Strategy Optimizer (LLM-powered) ─────────────────────────────────


  // ── Strategy Optimizer (LLM-powered) ─────────────────────────────────
  ipcMain.handle('strategy:optimize', async (_e, raw: unknown) => {
    const vErr = validate(StrategyOptimizeSchema, raw);
    if (vErr) return vErr;
    const { strategyDSL, backtestResult } = raw as {
      strategyDSL: { name: string; symbol?: string; type: string; params: Record<string, unknown>; stopLoss?: number; takeProfit?: number };
      backtestResult: { totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number; tradeCount?: number; equityCurve?: number[] };
    };

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
    const { callChatCompletions } = await import('../utils/ai-gateway-client');
    const result = await callChatCompletions({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 600,
    });
    if (!result.success) return result;
    const rawContent = result.content;
      let suggestions = [];
      try { suggestions = JSON.parse(rawContent).suggestions || []; } catch { suggestions = []; }
      return { success: true, suggestions };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Strategy Correlation Matrix ───────────────────────────────────────


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

  // ── Smart Notification Engine ───────────────────────────────────────


  // ── Auto-Tuner ──────────────────────────────────────────────────────
  ipcMain.handle('strategy:auto-tune', async (_e, raw: unknown) => {
    const vErr = validate(StrategyAutoTuneSchema, raw);
    if (vErr) return vErr;
    const { strategyType, ranges, klines, method, populationSize, generations, iterations } = raw as {
      strategyType: string;
      ranges: ParamRange[];
      klines: unknown[];
      method?: 'ga' | 'bayesian' | 'both';
      populationSize?: number;
      generations?: number;
      iterations?: number;
    };
    log.info(`[IPC] strategy:auto-tune — type=${strategyType} method=${method ?? 'both'}`);
    const result = await autoTune(strategyType, ranges, klines, { method, populationSize, generations, iterations });
    return { success: true, result };
  });

  // ── Q8: Market Regime Detector ─────────────────────────────────────────


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
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q17: Paper Trader (keep execute-signal + status, rest in second group) ──
  ipcMain.handle('paper:execute-signal', async (_e, raw: unknown) => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const signal = raw as unknown;
      const pt = getPaperTrader('default');
      const trade = pt.executeSignal(signal, signal.name);
      return { success: !!trade, trade };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('paper:status', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      return { success: true, status: getPaperTrader('default').getStatus() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q19: OpenD Health Check ─────────────────────────────────


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
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── JVS-39: Data Snapshot Service ──────────────────────────────────────


  // ── Q17: Paper Trader ──────────────────────

  ipcMain.handle('paper:start', async (_e, symbols?: string[]) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      pt.start(symbols);

      return { success: true, status: pt.getAccount() };

    } catch (err) {

      return { success: false, error: err.message };

    }

  });







  ipcMain.handle('paper:stop', async () => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      getPaperTrader('default').stop();

      return { success: true };

    } catch (err) {

      return { success: false, error: err.message };

    }

  });







  ipcMain.handle('paper:reset', async () => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      getPaperTrader('default').reset();

      return { success: true };

    } catch (err) {

      return { success: false, error: err.message };

    }

  });







  ipcMain.handle('paper:report', async (_e, strategyId?: string) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      const report = pt.getReport(strategyId);

      return { success: true, ...report };

    } catch (err) {

      return { success: false, error: err.message };

    }

  });







  ipcMain.handle('paper:submit-order', async (_e, raw: unknown) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      const order = raw as unknown;

      const orderId = pt.submitOrder(order);

      return { success: true, orderId };

    } catch (err) {

      return { success: false, error: err.message };

    }

  });

  // ── Q16: Dynamic Position Sizer ────────────────────────────────


  // ── Q15: Multi-Factor Model ─────────────────────────────────────
  ipcMain.handle('strategy:multi-factor', async (_e, raw: unknown) => {
    try {
      const { scoreStocks, scoreTopStocks } = require('./engine/multi-factor');
      const req = raw as { stocks?: Array<{ code: string; name: string }>; preset?: string; limit?: number };
      if (req.limit != null) {
        // Top stocks mode (multi-market: US/HK/CRYPTO)
        const result = await scoreTopStocks(req.limit, req.preset as unknown);
        return { success: true, ...result };
      }
      if (!req.stocks || req.stocks.length === 0) {
        return { success: false, error: 'stocks array is required' };
      }
      const result = await scoreStocks(req as unknown);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q12: Stress Tester ────────────────────────────────────────────


  // ── Q13: Backtest Comparator ──────────────────────────────────────
  ipcMain.handle('strategy:compare', async (_e, raw: unknown) => {
    try {
      const { compareBacktests, summaryTable } = require('./engine/backtest-comparator');
      const { results } = raw as { results: unknown[] };
      if (!results || results.length === 0) {
        return { success: false, error: 'At least one backtest result required' };
      }
      const comparison = compareBacktests(results);
      const table = summaryTable(results, comparison);
      return { success: true, comparison, table };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── NL Parser ───────────────────────────────────────────────────────


  // ── NL Parser ───────────────────────────────────────────────────────
  ipcMain.handle('nl:parse', async (_e, text: string) => {
    return parseNaturalLanguage(text);
  });



  ipcMain.handle('nl:templates', async () => {
    return { success: true, templates: STRATEGY_TEMPLATES };
  });

  ipcMain.handle('nl:instantiate-template', async (_e, id: string, overrides: unknown) => {
    try {
      const { STRATEGY_TEMPLATES } = require('../engine/nl-parser');
      const { parseNaturalLanguage } = require('../engine/nl-parser');
      const template = STRATEGY_TEMPLATES.find((t: any) => t.id === id);
      if (!template) return { success: false, error: `Template not found: ${id}` };
      // Use the NL parser to create a strategy from the template DSL
      const parsed = await parseNaturalLanguage(template.description || template.name);
      if (!parsed) return { success: false, error: 'Failed to parse template' };
      // Apply overrides if provided
      const strategyToSave = overrides
        ? { ...parsed, ...(overrides as Record<string, unknown>) }
        : parsed;
      const result = await (strategyEngine as any).createStrategy(strategyToSave);
      return { success: true, strategyId: result?.id, strategy: result };
    } catch (err: any) {
      log.error('[nl:instantiate-template] error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Risk Engine ─────────────────────────────────────────────────────


  // ── Correlation Matrix (Q2: QClaw) ──────────────────────────────────
  ipcMain.handle('strategy:correlation', async (_e, inputs: Array<{ id: string; equityCurve: Array<{ time: number; value: number }> }>) => {
    try {
      const { computeCorrelationMatrix } = require('./engine/correlation-matrix');
      const result = computeCorrelationMatrix(inputs);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Marketplace: Score & Verify (JVS) ─────────────────────────────────


  // ── Q14: Live Executor ──────────────────────────────────────────────
  ipcMain.handle('live:start', async (_e, symbols?: string[]) => {
    try {
      if (!liveExecutor) {
        return { success: false, error: 'LiveExecutor not initialized' };
      }
      liveExecutor.start(symbols);
      return { success: true, status: liveExecutor.getStatus() };
    } catch (err) {
      log.error('[live:start]', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('live:stop', async () => {
    try {
      liveExecutor?.stop();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('live:add-strategy', async (_e, config: unknown) => {
    try {
      if (!liveExecutor) return { success: false, error: 'LiveExecutor not initialized' };
      const { strategyId, symbol, signalType, price, quantity, stopLoss, takeProfit } = config;
      if (!strategyId || !symbol) return { success: false, error: 'strategyId and symbol required' };
      liveExecutor.addStrategy({ strategyId, symbol, signalType: signalType || 'BUY', price, quantity, stopLoss, takeProfit });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('live:remove-strategy', async (_e, strategyId: string) => {
    try {
      liveExecutor?.removeStrategy(strategyId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('live:get-status', async () => {
    return { success: true, status: liveExecutor?.getStatus() ?? null };
  });



  ipcMain.handle('live:get-positions', async () => {
    return { success: true, positions: liveExecutor?.getPositions() ?? [] };
  });



  ipcMain.handle('live:get-orders', async () => {
    return { success: true, orders: liveExecutor?.getOrders() ?? [] };
  });
}

// ── System Tray ────────────────────────────────────────────────────────────

function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createFromBuffer(createDiamondIcon(iconSize));
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: i18n.t('strategyIpc.k2'), enabled: false },
    { type: 'separator' },
    { label: i18n.t('strategyIpc.k3'), click: () => mainWindow?.show() },
    { label: i18n.t('strategyIpc.k4'), click: () => strategyEngine?.emergencyStop() },
    { type: 'separator' },
    { label: i18n.t('strategyIpc.k5'), click: () => app.quit() },
  ]);

  tray.setToolTip(i18n.t('strategyIpc.k6'));
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

// ── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info('[App] DAWN WHALES starting...');

  // Initialize modules
  try {
    db = new DatabaseManager();
    db.initialize();
  } catch (err) {
    log.error('[App] Database init failed:', err.message);
  }

  try {
    strategyEngine = new StrategyEngine();
    backtestEngine = new BacktestEngine();
    riskEngine = new RiskEngine();
    // v2: Connect risk engine to strategy engine
    if (strategyEngine && riskEngine) {
      strategyEngine.setRiskEngine(riskEngine);
      log.info('[App] StrategyEngine ↔ RiskEngine connected');
    }
    // Q14: Initialize live executor
    liveExecutor = initLiveExecutor(strategyEngine!);
    if (riskEngine) liveExecutor.setRiskEngine(riskEngine);
    log.info('[App] LiveExecutor initialized');
    brokerManager = new BrokerManager();

    // Q15: Initialize multi-factor model
    const { initMultiFactor } = require('./engine/multi-factor');
    const multiFactor = initMultiFactor();
    log.info('[App] MultiFactorModel initialized');

    // Q16: Initialize dynamic sizer
    const { initDynamicSizer } = require('./engine/dynamic-sizer');
    const dynamicSizer = initDynamicSizer();
    log.info('[App] DynamicSizer initialized');


    // Q17: Initialize paper trader
    const { initPaperTrader } = require('./engine/paper-trader');
    const paperTrader = initPaperTrader();
    log.info('[App] PaperTrader initialized');

  } catch (err) {
    log.error('[App] Engine init failed:', err.message);
  }

  try {
    if (db) {
      marketplaceService = new MarketplaceService(db);
      log.info('[App] MarketplaceService initialized');

      dataProvider = new DataProviderService();
      dataProvider.initialize(db);
      log.info('[App] DataProviderService initialized');

      emDataProvider = new EMDataProvider();
      emDataProvider.initialize(db);
      log.info('[App] EMDataProvider initialized (JVS-1)');

      macroDataProvider = new MacroDataProvider();
      macroDataProvider.initialize(db);
      log.info('[App] MacroDataProvider initialized (JVS-2)');

      stockScreener = new StockScreenerService();
      log.info('[App] StockScreenerService initialized (JVS-4)');

      newsAggregator = new NewsAggregatorService();
      newsAggregator.initialize(db);
      log.info('[App] NewsAggregatorService initialized (JVS-5)');

      sectorRotation = new SectorRotationMonitor();
      sectorRotation.initialize(db);
      log.info('[App] SectorRotationMonitor initialized (JVS-6)');

      stockAnomalyDetector = new StockAnomalyDetector();
      stockAnomalyDetector.initialize(db);
      log.info('[App] StockAnomalyDetector initialized (JVS-7)');

      marketHotspot = new MarketHotspotService();
      log.info('[App] MarketHotspotService initialized (JVS-8)');

      dataScheduler = new DataSchedulerService();
      // Register refresh callbacks
      dataScheduler.register('heatmap', async () => {
        if (emDataProvider) await emDataProvider.getHeatmap('industry');
      });

    } // end if (db)
  } catch (err) {
    log.error('[App] Service init failed:', (err as Error).message);
  }
}
