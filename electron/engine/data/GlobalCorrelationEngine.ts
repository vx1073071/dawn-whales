/**
 * GlobalCorrelationEngine — R257 QUANT MOO P1-4
 *
 * 全球联动分析引擎。计算跨市场资产之间的相关性矩阵，
 * 提供宏观日历驱动的相关性变化追踪。
 *
 * Feature set:
 *   - 跨市场相关矩阵: US/HK/CN/JP/EU/Crypto/Commodity/FX
 *   - 滚动相关窗口: 1D/5D/20D/60D
 *   - 宏观事件日历: FOMC/CPI/NFP/ECB/PBOC/财报季
 *   - 事件冲击模拟: 历史同类事件→当前相关变化预测
 *   - 领先/滞后: 发现哪个市场先动（Granger causality lite）
 *   - 热力图数据: 供前端 heatmap 消费
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Rolling window cache
 *   - Macro calendar with event → impact mapping
 *   - Mock data for testing
 *
 * @author JVS
 * @round R257
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type GlobalMarket = 'US' | 'HK' | 'CN' | 'JP' | 'EU' | 'CRYPTO' | 'COMMODITY' | 'FX';

export type MacroEventType = 'FOMC' | 'CPI' | 'NFP' | 'GDP' | 'ECB' | 'PBOC' | 'BOJ' | 'OPEC' |
  'EARNINGS_SEASON' | 'PMI' | 'RETAIL_SALES' | 'UNEMPLOYMENT' | 'INTEREST_RATE' | 'TRADE_BALANCE';

export type CorrelationWindow = '1D' | '5D' | '20D' | '60D';

export interface MarketIndex {
  market: GlobalMarket;
  symbol: string;
  name: string;
  values: number[];      // price history, index 0 = oldest
  timestamps: number[];
  currency: string;
}

export interface CorrelationPair {
  marketA: GlobalMarket;
  marketB: GlobalMarket;
  coefficient: number;   // -1 to 1
  window: CorrelationWindow;
  strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  direction: 'positive' | 'negative' | 'none';
  calculatedAt: number;
}

export interface CorrelationMatrix {
  window: CorrelationWindow;
  calculatedAt: number;
  markets: GlobalMarket[];
  matrix: Record<string, number>; // key = "US_HK", value = coefficient
}

export interface MacroEvent {
  id: string;
  type: MacroEventType;
  title: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM UTC
  country: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  forecast?: number;
  previous?: number;
  actual?: number;
  affectedMarkets: GlobalMarket[];
  expectedImpact: Record<GlobalMarket, number>; // -1 to 1
  description: string;
}

export interface EventImpactAnalysis {
  event: MacroEvent;
  historicalCorrelation: CorrelationPair[];
  predictedImpact: Record<GlobalMarket, number>;
  confidence: number;    // 0-1
}

export interface LeadingIndicator {
  leader: GlobalMarket;
  follower: GlobalMarket;
  lagDays: number;
  correlationAtLag: number;
  significance: number;  // 0-1, higher = more significant
}

export interface GlobalMarketReport {
  generatedAt: number;
  correlationMatrices: CorrelationMatrix[];
  topCorrelations: CorrelationPair[];
  upcomingEvents: MacroEvent[];
  recentEvents: MacroEvent[];
  leadingIndicators: LeadingIndicator[];
  summary: string;
}

// ─── Engine ──────────────────────────────────────────────

export class GlobalCorrelationEngine extends EventEmitter {
  private static instance: GlobalCorrelationEngine;

  private indices: Map<GlobalMarket, MarketIndex> = new Map();
  private events: MacroEvent[] = [];
  private correlationCache: Map<string, CorrelationMatrix> = new Map();
  private leadingCache: LeadingIndicator[] = [];
  private idCounter = 0;

  constructor() { super(); }

  static getInstance(): GlobalCorrelationEngine {
    if (!GlobalCorrelationEngine.instance) {
      GlobalCorrelationEngine.instance = new GlobalCorrelationEngine();
    }
    return GlobalCorrelationEngine.instance;
  }

  reset(): void {
    this.indices.clear();
    this.events = [];
    this.correlationCache.clear();
    this.leadingCache = [];
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Index Registration ────────────────────────────────

  registerIndex(idx: MarketIndex): void {
    this.indices.set(idx.market, idx);
  }

  getIndex(market: GlobalMarket): MarketIndex | undefined { return this.indices.get(market); }

  getRegisteredMarkets(): GlobalMarket[] { return [...this.indices.keys()]; }

  // ─── Correlation Calculation ───────────────────────────

  calcCorrelation(marketA: GlobalMarket, marketB: GlobalMarket, window: CorrelationWindow, lookback = 60): CorrelationPair | null {
    const a = this.indices.get(marketA);
    const b = this.indices.get(marketB);
    if (!a || !b || a.values.length < 2 || b.values.length < 2) return null;

    const n = Math.min(windowSize(window), a.values.length, b.values.length);
    const aSlice = a.values.slice(-n);
    const bSlice = b.values.slice(-n);

    const aReturns = returns(aSlice);
    const bReturns = returns(bSlice);
    const coef = pearson(aReturns, bReturns);

    const pair: CorrelationPair = {
      marketA, marketB,
      coefficient: Math.round(coef * 10000) / 10000,
      window,
      strength: classifyStrength(Math.abs(coef)),
      direction: coef > 0.05 ? 'positive' : coef < -0.05 ? 'negative' : 'none',
      calculatedAt: Date.now(),
    };

    this.emit('correlation_calculated', pair);
    return pair;
  }

  calcFullMatrix(window: CorrelationWindow = '20D'): CorrelationMatrix {
    const markets = this.getRegisteredMarkets();
    const matrix: Record<string, number> = {};
    const pairs: CorrelationPair[] = [];

    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const pair = this.calcCorrelation(markets[i], markets[j], window);
        if (pair) {
          matrix[`${markets[i]}_${markets[j]}`] = pair.coefficient;
          matrix[`${markets[j]}_${markets[i]}`] = pair.coefficient;
          pairs.push(pair);
        }
      }
    }

    const result: CorrelationMatrix = {
      window, calculatedAt: Date.now(), markets, matrix,
    };
    this.correlationCache.set(window, result);

    // Also emit pairs
    for (const p of pairs) {
      if (p.strength === 'strong' || p.strength === 'very_strong') {
        this.emit('significant_correlation', p);
      }
    }

    return result;
  }

  getCorrelation(marketA: GlobalMarket, marketB: GlobalMarket, window: CorrelationWindow = '20D'): number {
    const cached = this.correlationCache.get(window);
    if (cached) return cached.matrix[`${marketA}_${marketB}`] ?? 0;
    return 0;
  }

  getTopCorrelations(window: CorrelationWindow = '20D', limit = 10): CorrelationPair[] {
    return this.getAllPairCorrelations(window)
      .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
      .slice(0, limit);
  }

  private getAllPairCorrelations(window: CorrelationWindow): CorrelationPair[] {
    const markets = this.getRegisteredMarkets();
    const pairs: CorrelationPair[] = [];
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const p = this.calcCorrelation(markets[i], markets[j], window);
        if (p) pairs.push(p);
      }
    }
    return pairs;
  }

  // ─── Macro Calendar ────────────────────────────────────

  addEvent(event: MacroEvent): void {
    event.id = `evt_${++this.idCounter}`;
    this.events.push(event);
    this.emit('event_added', event);
  }

  getUpcomingEvents(limit = 10): MacroEvent[] {
    const now = new Date().toISOString().slice(0, 10);
    return this.events
      .filter(e => e.date >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, limit);
  }

  getEventsByDate(date: string): MacroEvent[] {
    return this.events.filter(e => e.date === date);
  }

  getEventsByMarket(market: GlobalMarket): MacroEvent[] {
    return this.events.filter(e => e.affectedMarkets.includes(market));
  }

  getEventsByType(type: MacroEventType): MacroEvent[] {
    return this.events.filter(e => e.type === type);
  }

  analyzeEvent(event: MacroEvent): EventImpactAnalysis {
    const historical = this.getTopCorrelations('20D', 20);
    const related = historical.filter(p =>
      p.marketA === event.affectedMarkets[0] || p.marketB === event.affectedMarkets[0]
    );

    const predictedImpact: Record<GlobalMarket, number> = {};
    for (const m of event.affectedMarkets) {
      predictedImpact[m] = event.expectedImpact[m] ?? 0;
    }

    const confidence = event.importance === 'critical' ? 0.9
      : event.importance === 'high' ? 0.7
      : event.importance === 'medium' ? 0.5 : 0.3;

    return { event, historicalCorrelation: related, predictedImpact, confidence };
  }

  // ─── Leading Indicators ────────────────────────────────

  calcLeadingIndicators(maxLag = 5): LeadingIndicator[] {
    const markets = this.getRegisteredMarkets();
    const results: LeadingIndicator[] = [];

    for (const leader of markets) {
      for (const follower of markets) {
        if (leader === follower) continue;
        let bestLag = 0;
        let bestCorr = 0;

        for (let lag = 1; lag <= maxLag; lag++) {
          const a = this.indices.get(leader);
          const b = this.indices.get(follower);
          if (!a || !b) continue;
          const aRet = returns(a.values.slice(0, -lag));
          const bRet = returns(b.values.slice(lag));
          const corr = Math.abs(pearson(aRet, bRet));
          if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
        }

        if (bestCorr > 0.5) {
          results.push({
            leader, follower, lagDays: bestLag,
            correlationAtLag: Math.round(bestCorr * 10000) / 10000,
            significance: Math.round(bestCorr * 100) / 100,
          });
        }
      }
    }

    this.leadingCache = results.sort((a, b) => b.significance - a.significance);
    return this.leadingCache;
  }

  getLeadingIndicators(): LeadingIndicator[] { return this.leadingCache; }

  // ─── Report ────────────────────────────────────────────

  generateReport(): GlobalMarketReport {
    const matrix20 = this.calcFullMatrix('20D');
    const summary = `Global correlation report. ${this.getRegisteredMarkets().length} markets tracked. ` +
      `${this.getUpcomingEvents().length} upcoming macro events.`;

    return {
      generatedAt: Date.now(),
      correlationMatrices: [matrix20],
      topCorrelations: this.getTopCorrelations('20D', 10),
      upcomingEvents: this.getUpcomingEvents(10),
      recentEvents: this.events.slice(-10),
      leadingIndicators: this.leadingCache,
      summary,
    };
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockIndices(): void {
    const base = Date.now();
    const generate = (len: number, start: number, volatility: number) => {
      const vals: number[] = [start];
      for (let i = 1; i < len; i++) {
        vals.push(vals[i - 1] * (1 + (Math.random() - 0.48) * volatility / 100));
      }
      return vals;
    };

    const n = 60;
    this.registerIndex({ market: 'US', symbol: 'SPX', name: 'S&P 500', values: generate(n, 5200, 0.8), timestamps: [], currency: 'USD' });
    this.registerIndex({ market: 'HK', symbol: 'HSI', name: 'Hang Seng', values: generate(n, 18000, 1.2), timestamps: [], currency: 'HKD' });
    this.registerIndex({ market: 'CN', symbol: 'SSE', name: 'Shanghai', values: generate(n, 3200, 1.0), timestamps: [], currency: 'CNY' });
    this.registerIndex({ market: 'JP', symbol: 'N225', name: 'Nikkei 225', values: generate(n, 38000, 0.9), timestamps: [], currency: 'JPY' });
    this.registerIndex({ market: 'EU', symbol: 'STOXX', name: 'Euro Stoxx 50', values: generate(n, 4900, 0.8), timestamps: [], currency: 'EUR' });
    this.registerIndex({ market: 'CRYPTO', symbol: 'BTC', name: 'Bitcoin', values: generate(n, 68000, 3.0), timestamps: [], currency: 'USD' });
    this.registerIndex({ market: 'COMMODITY', symbol: 'GOLD', name: 'Gold', values: generate(n, 2400, 1.5), timestamps: [], currency: 'USD' });
    this.registerIndex({ market: 'FX', symbol: 'DXY', name: 'Dollar Index', values: generate(n, 104, 0.4), timestamps: [], currency: 'USD' });
  }

  createMockEvents(): MacroEvent[] {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const events: MacroEvent[] = [
      { id: '', type: 'FOMC', title: 'FOMC 利率决议', date: dateStr(tomorrow), time: '18:00', country: 'US', importance: 'critical', affectedMarkets: ['US', 'HK', 'CRYPTO', 'FX'], expectedImpact: { US: 0.8, HK: 0.6, CRYPTO: 0.9, FX: 0.9, JP: 0, CN: 0, EU: 0, COMMODITY: 0 }, description: '美联储利率决议及点阵图' },
      { id: '', type: 'CPI', title: '美国 CPI 数据', date: dateStr(tomorrow), time: '12:30', country: 'US', importance: 'high', affectedMarkets: ['US', 'HK', 'FX', 'COMMODITY'], expectedImpact: { US: 0.7, HK: 0.5, FX: 0.8, COMMODITY: 0.6, JP: 0, CN: 0, EU: 0, CRYPTO: 0 }, description: '消费者物价指数月率' },
      { id: '', type: 'PBOC', title: '中国央行 MLF 操作', date: dateStr(tomorrow), time: '01:30', country: 'CN', importance: 'high', affectedMarkets: ['CN', 'HK'], expectedImpact: { CN: 0.8, HK: 0.6, US: 0, JP: 0, EU: 0, CRYPTO: 0, COMMODITY: 0, FX: 0 }, description: '中期借贷便利利率' },
    ];
    for (const e of events) {
      e.id = `evt_${++this.idCounter}`;
      this.addEvent(e);
    }
    return events;
  }
}

// ─── Helpers ─────────────────────────────────────────────

function windowSize(w: CorrelationWindow): number {
  switch (w) { case '1D': return 1; case '5D': return 5; case '20D': return 20; case '60D': return 60; }
}

function returns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] === 0) r.push(0);
    else r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return r;
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

function classifyStrength(absCoef: number): CorrelationPair['strength'] {
  if (absCoef > 0.8) return 'very_strong';
  if (absCoef > 0.6) return 'strong';
  if (absCoef > 0.3) return 'moderate';
  return 'weak';
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
