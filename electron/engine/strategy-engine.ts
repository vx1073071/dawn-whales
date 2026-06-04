// ── Strategy Engine — 策略执行引擎 v2 ──────────────────────────────────────
// 管理策略生命周期：创建 → 回测 → 模拟 → 实盘 → 停止
// 实时行情驱动信号评估，触发交易指令
// v2: 接入风控引擎 (Kelly sizing / ATR trailing stop / equity tracking)

import log from 'electron-log';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from './nl-parser';
import { BacktestEngine } from './backtest-engine';
import type { RiskEngine } from './risk-engine';

// ── Types ──────────────────────────────────────────────────────────────────

interface StrategyConfig {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'combined';
  params: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  symbol: string;
  strategy: StrategyConfig;
  status: 'draft' | 'backtested' | 'simulating' | 'live' | 'stopped';
  createdAt: number;
  lastSignal?: { type: 'BUY' | 'SELL' | 'HOLD'; time: number; price: number };
  backtestResult?: any;
  position: { qty: number; avgCost: number } | null;
}

interface SignalEvent {
  strategyId: string;
  strategyName: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  time: number;
  reason: string;
}

type SignalCallback = (event: SignalEvent) => void;
type TradeCallback = (order: any) => void;

// ── Technical Indicator Helpers (simplified, streaming) ────────────────────

class StreamingIndicators {
  private closes: number[] = [];
  private config: StrategyConfig;

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  push(close: number) {
    this.closes.push(close);
    // Keep last 200 bars
    if (this.closes.length > 200) this.closes.shift();
  }

  getSignal(): { signal: 'BUY' | 'SELL' | 'HOLD'; reason: string } {
    const n = this.closes.length;
    if (n < 30) return { signal: 'HOLD', reason: '数据不足' };

    const p = this.config.params;

    switch (this.config.type) {
      case 'ma_cross': {
        const shortP = p.shortPeriod ?? 10;
        const longP = p.longPeriod ?? 30;
        if (n < longP + 1) return { signal: 'HOLD', reason: '均线数据不足' };

        const smaShort = this.closes.slice(-shortP).reduce((a, b) => a + b, 0) / shortP;
        const smaLong = this.closes.slice(-longP).reduce((a, b) => a + b, 0) / longP;
        const prevShort = this.closes.slice(-shortP - 1, -1).reduce((a, b) => a + b, 0) / shortP;
        const prevLong = this.closes.slice(-longP - 1, -1).reduce((a, b) => a + b, 0) / longP;

        const prevCross = prevShort - prevLong;
        const currCross = smaShort - smaLong;

        if (prevCross <= 0 && currCross > 0) {
          return { signal: 'BUY', reason: `MA${shortP} 上穿 MA${longP}` };
        }
        if (prevCross >= 0 && currCross < 0) {
          return { signal: 'SELL', reason: `MA${shortP} 下穿 MA${longP}` };
        }
        return { signal: 'HOLD', reason: `MA${shortP}=${smaShort.toFixed(2)}, MA${longP}=${smaLong.toFixed(2)}` };
      }

      case 'rsi': {
        const period = p.rsiPeriod ?? 14;
        if (n < period + 2) return { signal: 'HOLD', reason: 'RSI 数据不足' };

        const changes = [];
        for (let i = n - period; i < n; i++) {
          changes.push(this.closes[i] - this.closes[i - 1]);
        }
        const gains = changes.filter((c) => c > 0);
        const losses = changes.filter((c) => c < 0).map((c) => Math.abs(c));
        const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0.001;
        const rs = avgGain / avgLoss;
        const rsiVal = 100 - 100 / (1 + rs);

        // Previous RSI
        const prevChanges = [];
        for (let i = n - period - 1; i < n - 1; i++) {
          prevChanges.push(this.closes[i] - this.closes[i - 1]);
        }
        const prevGains = prevChanges.filter((c) => c > 0);
        const prevLosses = prevChanges.filter((c) => c < 0).map((c) => Math.abs(c));
        const prevAvgGain = prevGains.length > 0 ? prevGains.reduce((a, b) => a + b, 0) / period : 0;
        const prevAvgLoss = prevLosses.length > 0 ? prevLosses.reduce((a, b) => a + b, 0) / period : 0.001;
        const prevRS = prevAvgGain / prevAvgLoss;
        const prevRSI = 100 - 100 / (1 + prevRS);

        const oversold = p.oversold ?? 30;
        const overbought = p.overbought ?? 70;

        if (prevRSI <= oversold && rsiVal > oversold) {
          return { signal: 'BUY', reason: `RSI 从 ${prevRSI.toFixed(1)} 突破超卖线 ${oversold} → ${rsiVal.toFixed(1)}` };
        }
        if (prevRSI >= overbought && rsiVal < overbought) {
          return { signal: 'SELL', reason: `RSI 从 ${prevRSI.toFixed(1)} 跌破超买线 ${overbought} → ${rsiVal.toFixed(1)}` };
        }
        return { signal: 'HOLD', reason: `RSI = ${rsiVal.toFixed(1)}` };
      }

      default:
        return { signal: 'HOLD', reason: '未实现的策略类型' };
    }
  }
}

// ── Strategy Engine ────────────────────────────────────────────────────────

export class StrategyEngine {
  private strategies = new Map<string, Strategy>();
  private indicators = new Map<string, StreamingIndicators>();
  private signalCallbacks: SignalCallback[] = [];
  private tradeCallbacks: TradeCallback[] = [];
  private backtestEngine = new BacktestEngine();
  private riskEngine: RiskEngine | null = null;

  // ── Risk Engine Integration ──────────────────────────────────────

  setRiskEngine(riskEngine: RiskEngine): void {
    this.riskEngine = riskEngine;
    log.info('[StrategyEngine] RiskEngine connected');
  }

  // ── Strategy CRUD ──────────────────────────────────────────────────

  createStrategy(input: any): string {
    let config: StrategyConfig;
    let name: string;
    let description: string;
    let symbol: string;

    if (typeof input === 'string' || input.text) {
      // Natural language input
      const text = typeof input === 'string' ? input : input.text;
      const parsed = parseNaturalLanguage(text);
      if (!parsed.success) {
        log.warn('[StrategyEngine] NL parse failed:', parsed.error);
        // Create anyway as draft
        name = '未命名策略';
        description = text;
        config = { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } };
        symbol = parsed.symbol || 'US.TQQQ';
      } else {
        name = parsed.name;
        description = parsed.description;
        config = parsed.strategy;
        symbol = parsed.symbol || 'US.TQQQ';
      }
    } else if (input.templateId) {
      // Template selection
      const template = STRATEGY_TEMPLATES.find((t) => t.id === input.templateId);
      if (!template) throw new Error(`Template not found: ${input.templateId}`);
      name = template.name;
      description = template.description;
      config = template.strategy;
      symbol = template.symbol || input.symbol || 'US.TQQQ';
    } else if (input.strategy) {
      // Direct config
      name = input.name || '自定义策略';
      description = input.description || '';
      config = input.strategy;
      symbol = input.symbol || 'US.TQQQ';
    } else {
      throw new Error('Invalid strategy input');
    }

    const id = `strat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const strategy: Strategy = {
      id, name, description, symbol,
      strategy: config,
      status: 'draft',
      createdAt: Date.now(),
      position: null,
    };

    this.strategies.set(id, strategy);
    log.info(`[StrategyEngine] Created: ${id} "${name}" (${config.type})`);
    return id;
  }

  getStrategy(id: string): Strategy | undefined {
    return this.strategies.get(id);
  }

  getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  deleteStrategy(id: string) {
    this.stopLive(id);
    this.strategies.delete(id);
    this.indicators.delete(id);
    log.info(`[StrategyEngine] Deleted: ${id}`);
  }

  // ── Backtest ──────────────────────────────────────────────────────

  async runBacktest(strategyId: string, klines: any[]): Promise<any> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);

    const result = await this.backtestEngine.run({
      strategyId,
      strategyName: strategy.name,
      symbol: strategy.symbol,
      initialCapital: 100000,
      commission: 0.001,
      slippage: 0.0005,
      strategy: strategy.strategy,
      klines,
    });

    if (result.success) {
      strategy.status = 'backtested';
      strategy.backtestResult = result.result;
    }

    return result;
  }

  // ── Live Trading ──────────────────────────────────────────────────

  startLive(strategyId: string) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return;

    if (strategy.status === 'live') {
      log.warn(`[StrategyEngine] Already live: ${strategyId}`);
      return;
    }

    strategy.status = 'live';
    this.indicators.set(strategyId, new StreamingIndicators(strategy.strategy));
    log.info(`[StrategyEngine] 🟢 Live started: ${strategyId} "${strategy.name}"`);
  }

  stopLive(strategyId: string) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return;

    if (strategy.status === 'live' || strategy.status === 'simulating') {
      strategy.status = 'stopped';
      this.indicators.delete(strategyId);
      log.info(`[StrategyEngine] 🔴 Stopped: ${strategyId}`);
    }
  }

  emergencyStop() {
    log.warn('[StrategyEngine] 🚨 EMERGENCY STOP — stopping all live strategies');
    for (const [id, strategy] of this.strategies) {
      if (strategy.status === 'live' || strategy.status === 'simulating') {
        strategy.status = 'stopped';
        this.indicators.delete(id);
        log.info(`[StrategyEngine] Emergency stopped: ${id}`);
      }
    }
  }

  // ── Real-time Quote Processing ────────────────────────────────────

  onQuoteUpdate(quotes: any[]) {
    for (const [id, strategy] of this.strategies) {
      if (strategy.status !== 'live') continue;

      // Find matching quote
      const quote = quotes.find((q: any) => q.code === strategy.symbol);
      if (!quote) continue;

      // v2: Update equity tracking for drawdown monitoring
      if (this.riskEngine && strategy.position) {
        const positionValue = strategy.position.qty * quote.price;
        // Estimate total equity (simplified: position value + assumed cash)
        // In production, this should come from the broker's funds API
        const estimatedEquity = positionValue * 2; // rough estimate
        this.riskEngine.updateEquity(estimatedEquity);
      }

      // Update streaming indicators
      const ind = this.indicators.get(id);
      if (!ind) continue;

      ind.push(quote.price);

      // Evaluate signal
      const { signal, reason } = ind.getSignal();
      if (signal === 'HOLD') continue;

      strategy.lastSignal = { type: signal, time: Date.now(), price: quote.price };

      const event: SignalEvent = {
        strategyId: id,
        strategyName: strategy.name,
        symbol: strategy.symbol,
        signal,
        price: quote.price,
        time: Date.now(),
        reason,
      };

      log.info(`[StrategyEngine] Signal: ${signal} ${strategy.symbol} @ ${quote.price} — ${reason}`);

      // Notify listeners
      for (const cb of this.signalCallbacks) {
        try { cb(event); } catch (e: any) { log.error('[StrategyEngine] Signal callback error:', e.message); }
      }

      // Generate trade order if applicable
      if (signal === 'BUY' && !strategy.position) {
        // v2: Calculate position size using risk engine
        let qty = 0;
        let sizingReason = '';
        if (this.riskEngine) {
          const sizing = this.riskEngine.calculatePositionSize(quote.price);
          qty = sizing.qty;
          sizingReason = sizing.reasoning;
          log.info(`[StrategyEngine] Position sizing: qty=${qty}, method=${sizing.method}, ${sizingReason}`);
        }

        const order = {
          code: strategy.symbol,
          side: 'BUY',
          orderType: 'MARKET',
          qty,
          price: quote.price,
          strategyId: id,
          reason: `${reason} | ${sizingReason}`,
        };
        for (const cb of this.tradeCallbacks) {
          try { cb(order); } catch (e: any) { log.error('[StrategyEngine] Trade callback error:', e.message); }
        }
      } else if (signal === 'SELL' && strategy.position && strategy.position.qty > 0) {
        // v2: Record trade for Kelly calculation
        if (this.riskEngine && strategy.position.avgCost > 0) {
          const pnl = (quote.price - strategy.position.avgCost) * strategy.position.qty;
          this.riskEngine.recordTrade(pnl);
          log.info(`[StrategyEngine] Trade recorded: pnl=$${pnl.toFixed(2)}`);
        }

        const order = {
          code: strategy.symbol,
          side: 'SELL',
          orderType: 'MARKET',
          qty: strategy.position.qty,
          price: quote.price,
          strategyId: id,
          reason,
        };
        for (const cb of this.tradeCallbacks) {
          try { cb(order); } catch (e: any) { log.error('[StrategyEngine] Trade callback error:', e.message); }
        }
      }

      // Check stop-loss / take-profit
      if (strategy.position && strategy.position.avgCost > 0) {
        const pnlPct = ((quote.price - strategy.position.avgCost) / strategy.position.avgCost) * 100;

        if (strategy.strategy.stopLoss && pnlPct <= -strategy.strategy.stopLoss) {
          log.warn(`[StrategyEngine] ⚠️ Stop loss triggered: ${id} PnL ${pnlPct.toFixed(2)}%`);

          // v2: Record trade for Kelly calculation
          if (this.riskEngine) {
            const pnl = (quote.price - strategy.position.avgCost) * strategy.position.qty;
            this.riskEngine.recordTrade(pnl);
          }

          const order = {
            code: strategy.symbol, side: 'SELL', orderType: 'MARKET',
            qty: strategy.position.qty, price: quote.price,
            strategyId: id, reason: `止损触发 (${pnlPct.toFixed(1)}%)`,
          };
          for (const cb of this.tradeCallbacks) { try { cb(order); } catch {} }
        } else if (strategy.strategy.takeProfit && pnlPct >= strategy.strategy.takeProfit) {
          log.info(`[StrategyEngine] ✅ Take profit: ${id} PnL ${pnlPct.toFixed(2)}%`);

          // v2: Record trade for Kelly calculation
          if (this.riskEngine) {
            const pnl = (quote.price - strategy.position.avgCost) * strategy.position.qty;
            this.riskEngine.recordTrade(pnl);
          }

          const order = {
            code: strategy.symbol, side: 'SELL', orderType: 'MARKET',
            qty: strategy.position.qty, price: quote.price,
            strategyId: id, reason: `止盈触发 (${pnlPct.toFixed(1)}%)`,
          };
          for (const cb of this.tradeCallbacks) { try { cb(order); } catch {} }
        }
      }
    }
  }

  // ── Event Registration ────────────────────────────────────────────

  onSignal(callback: SignalCallback) {
    this.signalCallbacks.push(callback);
  }

  onTrade(callback: TradeCallback) {
    this.tradeCallbacks.push(callback);
  }

  // ── Position Tracking ─────────────────────────────────────────────

  updatePosition(strategyId: string, position: { qty: number; avgCost: number } | null) {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.position = position;
      log.info(`[StrategyEngine] Position updated: ${strategyId}`, position);
    }
  }
}
