// -- IPC Handlers: strategy (11 handlers) --

import { ipcMain, app } from 'electron';
import { shared } from './_import-shared';
import { validate, StrategyCreateSchema, StrategyUpdateSchema, StrategyGetSchema, StrategyBacktestSchema, StrategyExplainSchema, StrategyCompareSchema, StrategyOptimizeSchema } from '../ipc-schemas';
import { getDeepSeekKey } from '../utils/secure-key';
import log from 'electron-log';

const STRATEGY_UPDATE_WHITELIST = ['name', 'description', 'params', 'stopLoss', 'takeProfit', 'symbol'];

export function registerStrategyHandlers() {

  ipcMain.handle('strategy:create', async (_e, dsl: any) => {
      const vErr = validate(StrategyCreateSchema, { dsl });
      if (vErr) return vErr;
      try {
        const id = shared.strategyEngine?.createStrategy(dsl);
        const strategy = shared.strategyEngine?.getStrategy(id!);
        if (strategy && db) shared.db.saveStrategy(strategy);
        return { success: true, id, strategy };
      } catch (err: any) { return { success: false, error: err.message }; }
    });


  ipcMain.handle('strategy:getAll', async () => {
      return { success: true, strategies: shared.strategyEngine?.getAllStrategies() || [] };
    });


  ipcMain.handle('strategy:get', async (_e, id: string) => {
      const strategy = shared.strategyEngine?.getStrategy(id);
      return { success: !!strategy, strategy };
    });


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
        if (db) shared.db.saveStrategy(strategy);
        return { success: true, strategy };
      } catch (err: any) { return { success: false, error: err.message }; }
    });


  ipcMain.handle('strategy:delete', async (_e, id: string) => {
      shared.strategyEngine?.deleteStrategy(id);
      shared.db?.deleteStrategy(id);
      return { success: true };
    });


  ipcMain.handle('strategy:backtest', async (_e, config: any) => {
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
              if (klines.length > 0 && db) shared.db.saveKlines(config.symbol || 'US.TQQQ', config.period || 'daily', klines);
            }
          }
        }

        if (!klines || klines.length < 50) {
          return { success: false, error: 'K线数据不足（需要至少50根），请确认 OpenD 已连接' };
        }

        const strategyId = config.strategyId;
        if (strategyId) {
          const result = await shared.strategyEngine.runBacktest(strategyId, klines);
          if (result.success && db) {
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


  ipcMain.handle('strategy:explain', async (_e, strategy: any) => {
      const apiKey = getDeepSeekKey(app);
      if (!apiKey) {
        return { success: false, error: 'DeepSeek API key not configured. Use Settings to set your key.' };
      }
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
      const apiKey = getDeepSeekKey(app);
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


  ipcMain.handle('strategy:optimize', async (_e, raw: unknown) => {
      const vErr = validate(StrategyOptimizeSchema, raw);
      if (vErr) return vErr;
      const { strategyDSL, backtestResult } = raw as {
        strategyDSL: { name: string; symbol?: string; type: string; params: Record<string, unknown>; stopLoss?: number; takeProfit?: number };
        backtestResult: { totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number; tradeCount?: number; equityCurve?: number[] };
      };
      const apiKey = getDeepSeekKey(app);
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

}
