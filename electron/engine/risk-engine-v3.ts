/**
 * Risk Engine V3 - Real-time risk scoring and auto-rebalancing
 * JVS-46-02: Risk V3 Engine
 * Provides real-time risk assessment and automatic rebalancing signals
 */

import log from 'electron-log';

// ── EventEmitter Polyfill ──────────────────────────────────────────────────

class EventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          log.error(`[RiskEngine] Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskScore {
  overall: number;         // 0-100
  drawdown: number;        // 0-100
  volatility: number;      // 0-100
  concentration: number;   // 0-100
  correlation: number;     // 0-100
  timestamp: number;
}

export interface RiskAlert {
  type: 'drawdown' | 'volatility' | 'concentration' | 'correlation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface RebalanceSignal {
  action: 'reduce' | 'increase' | 'rebalance';
  symbol?: string;
  targetWeight?: number;
  reason: string;
}

export interface RiskThresholds {
  drawdown: number;
  volatility: number;
  concentration: number;
  correlation: number;
}

export interface RiskMetrics {
  avgRiskScore: number;
  alertCount: number;
  rebalanceCount: number;
}

export interface PortfolioPosition {
  symbol: string;
  weight: number;
  value: number;
  pnl: number;
  pnlPct: number;
}

export interface MarketData {
  returns: number[];
  benchmarkReturns?: number[];
  currentPrice: number;
  historicalPrices: number[];
}

// ── V3 Multi-Broker Types ──────────────────────────────────────────────────

export interface AggregateAccountInfo {
  brokerId: string;
  accountId: string;
  name: string;
  currency: string;
  totalAssets: number;
  cash: number;
  marketValue: number;
  positions: AggregatedPosition[];
}

export interface AggregatedPosition {
  code: string;
  name: string;
  qty: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  ratio: number;
}

export interface AggregatedPortfolio {
  totalAssets: number;
  totalExposure: number;
  netExposure: number;
  leverageRatio: number;
  accounts: AggregateAccountInfo[];
}

export interface AggregateResult {
  success: boolean;
  portfolio: AggregatedPortfolio;
  errors: { brokerId: string; error: string }[];
}

export interface MarginAccountInfo {
  brokerId: string;
  accountId: string;
  currency: string;
  frozenCash: number;
  availableCash: number;
  totalMargin: number;
  utilizationRatio: number;
  marginCallRisk: 'none' | 'warning' | 'danger';
}

export interface MarginResult {
  accounts: MarginAccountInfo[];
  anyMarginCallRisk: boolean;
  maxUtilization: number;
}

export interface PortfolioExposure {
  bySector: Record<string, number>;
  byGeography: Record<string, number>;
  byAssetClass: Record<string, number>;
  topPositions: { code: string; name: string; weight: number; marketValue: number }[];
  concentrationRisk: number;
}

export interface CircuitBreakerResult {
  market: string;
  status: 'open' | 'resume_pending' | 'halted';
  triggerLevel: number;
  reason?: string;
  indexCode?: string;
  changePct?: number;
  cachedAt?: number;
}

// ── FX Rates (to HKD) ──────────────────────────────────────────────────────

const FX_RATES_TO_HKD: Record<string, number> = {
  HKD: 1.0,
  USD: 7.78,
  CNY: 1.07,
  EUR: 8.50,
  GBP: 9.80,
  JPY: 0.052,
  SGD: 5.78,
  AUD: 5.10,
  CAD: 5.70,
};

function toHKD(amount: number, currency: string): number {
  const rate = FX_RATES_TO_HKD[currency] ?? 1.0;
  return Math.round(amount * rate);
}

// ── Known ETF codes ────────────────────────────────────────────────────────

const KNOWN_ETFS = new Set([
  'US.QQQ', 'US.SPY', 'US.GLD', 'US.TLT', 'US.IWM', 'US.VTI',
  'US.VOO', 'US.EEM', 'US.EFA', 'US.XLF', 'US.XLE', 'US.XLK',
  'US.TQQQ', 'US.SQQQ', 'US.UPRO', 'US.SOXL', 'US.GDX',
  'HK.02800', 'HK.03067', 'HK.09988', 'HK.02840',
]);

// ── Index codes for circuit breaker ────────────────────────────────────────

const MARKET_INDEX_CODES: Record<string, string> = {
  HK: 'HK.HSI',
  US: 'US.SPX',
  CN: 'CN.000300',
};

// ── Risk Engine V3 ─────────────────────────────────────────────────────────

export class RiskEngineV3 extends EventEmitter {
  private thresholds: RiskThresholds;
  private alerts: RiskAlert[] = [];
  private riskHistory: RiskScore[] = [];
  private rebalanceHistory: RebalanceSignal[] = [];
  private maxHistorySize: number = 1000;
  private maxAlertsSize: number = 100;
  private maxRebalanceSize: number = 50;
  private brokerAdapters: any[] = [];
  private baseEngine: any = null;

  // Caches
  private aggregateCache: Map<string, { data: AggregateResult; timestamp: number }> = new Map();
  private marginCache: Map<string, { data: MarginAccountInfo; timestamp: number }> = new Map();
  private circuitBreakerCache: Map<string, { data: CircuitBreakerResult; timestamp: number }> = new Map();
  private exposureCache: { data: PortfolioExposure; timestamp: number } | null = null;

  private static readonly AGGREGATE_CACHE_TTL = 30_000;   // 30s
  private static readonly MARGIN_CACHE_TTL = 30_000;       // 30s
  private static readonly CIRCUIT_BREAKER_CACHE_TTL = 60_000; // 60s
  private static readonly EXPOSURE_CACHE_TTL = 30_000;     // 30s

  constructor(brokers?: any[], baseEngine?: any) {
    super();
    this.brokerAdapters = brokers || [];
    this.baseEngine = baseEngine;
    this.thresholds = {
      drawdown: 20,        // 20% max drawdown
      volatility: 30,      // 30% annualized volatility
      concentration: 40,   // 40% max single position
      correlation: 0.8,    // 0.8 max correlation
    };
    log.info('[RiskEngineV3] Initialized with default thresholds');
  }

  // ── Core Risk Evaluation ───────────────────────────────────────────────

  evaluateRisk(portfolio: PortfolioPosition[], marketData: MarketData): RiskScore {
    const timestamp = Date.now();

    const drawdownRisk = this.calculateDrawdownRisk(marketData);
    const volatilityRisk = this.calculateVolatilityRisk(marketData);
    const concentrationRisk = this.calculateConcentrationRisk(portfolio);
    const correlationRisk = this.calculateCorrelationRisk(portfolio, marketData);

    const overall = (
      drawdownRisk * 0.35 +
      volatilityRisk * 0.30 +
      concentrationRisk * 0.25 +
      correlationRisk * 0.20
    );

    const score: RiskScore = {
      overall: Math.min(100, Math.max(0, overall)),
      drawdown: drawdownRisk,
      volatility: volatilityRisk,
      concentration: concentrationRisk,
      correlation: correlationRisk,
      timestamp,
    };

    this.riskHistory.push(score);
    if (this.riskHistory.length > this.maxHistorySize) {
      this.riskHistory.shift();
    }

    this.checkThresholds(score);
    this.emit('risk-evaluated', score);
    log.debug(`[RiskEngineV3] Risk evaluated: overall=${score.overall.toFixed(2)}`);

    return score;
  }

  getAlerts(): RiskAlert[] {
    return [...this.alerts];
  }

  suggestRebalance(portfolio: PortfolioPosition[]): RebalanceSignal[] {
    const signals: RebalanceSignal[] = [];

    // Concentration check: each position vs threshold
    const concentrationThreshold = this.thresholds.concentration / 100;
    for (const pos of portfolio) {
      if (pos.weight > concentrationThreshold) {
        signals.push({
          action: 'reduce',
          symbol: pos.symbol,
          targetWeight: concentrationThreshold,
          reason: `Position ${pos.symbol} weight ${(pos.weight * 100).toFixed(1)}% exceeds concentration threshold (${this.thresholds.concentration}%)`,
        });
      }
    }

    // Drawdown check: use most recent evaluation (only if drawdown is severe)
    const latestScore = this.riskHistory.length > 0 ? this.riskHistory[this.riskHistory.length - 1] : null;
    if (latestScore && latestScore.drawdown > this.thresholds.drawdown * 2) {
      // Only suggest rebalance for severe drawdowns (>2x threshold)
      signals.push({
        action: 'reduce',
        reason: `Portfolio drawdown ${latestScore.drawdown.toFixed(2)}% far exceeds threshold (${this.thresholds.drawdown}%)`,
      });
    }

    // Store and emit
    this.rebalanceHistory.push(...signals);
    if (this.rebalanceHistory.length > this.maxRebalanceSize) {
      this.rebalanceHistory = this.rebalanceHistory.slice(-this.maxRebalanceSize);
    }

    if (signals.length > 0) {
      this.emit('rebalance-suggested', signals);
      log.info(`[RiskEngineV3] Suggested ${signals.length} rebalance signals`);
    }

    return signals;
  }

  setThresholds(thresholds: RiskThresholds): void {
    this.thresholds = { ...thresholds };
    this.emit('thresholds-updated', thresholds);
    log.info('[RiskEngineV3] Thresholds updated:', thresholds);
  }

  getMetrics(): RiskMetrics {
    const avgRiskScore = this.riskHistory.length > 0
      ? this.riskHistory.reduce((sum, s) => sum + s.overall, 0) / this.riskHistory.length
      : 0;

    return {
      avgRiskScore: Math.round(avgRiskScore * 100) / 100,
      alertCount: this.alerts.length,
      rebalanceCount: this.rebalanceHistory.length,
    };
  }

  reset(): void {
    this.alerts = [];
    this.riskHistory = [];
    this.rebalanceHistory = [];
    this.emit('reset');
    log.info('[RiskEngineV3] Reset');
  }

  getRiskHistory(): RiskScore[] {
    return [...this.riskHistory];
  }

  getRebalanceHistory(): RebalanceSignal[] {
    return [...this.rebalanceHistory];
  }

  // ── V3: Multi-Broker Account Aggregation ──────────────────────────────

  async aggregateAccounts(options: {
    brokerIds: string[];
    forceRefresh?: boolean;
  }): Promise<AggregateResult> {
    const cacheKey = options.brokerIds.sort().join(',');
    const now = Date.now();

    // Check cache
    if (!options.forceRefresh) {
      const cached = this.aggregateCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < RiskEngineV3.AGGREGATE_CACHE_TTL) {
        log.debug(`[RiskEngineV3] Returning cached aggregate for ${cacheKey}`);
        return cached.data;
      }
    }

    const errors: { brokerId: string; error: string }[] = [];
    const accounts: AggregateAccountInfo[] = [];

    for (const brokerId of options.brokerIds) {
      const adapter = this.brokerAdapters.find((a: any) => a.type === brokerId);
      if (!adapter) {
        errors.push({ brokerId, error: `No adapter found for broker: ${brokerId}` });
        continue;
      }

      try {
        const accInfos = await adapter.getAccounts();
        const funds = await adapter.getFunds();
        const positions = await adapter.getPositions();

        for (const acc of accInfos) {
          const accountTotalHKD = toHKD(acc.totalAssets || funds.totalAssets, acc.currency || funds.currency);
          const accountCashHKD = toHKD(acc.cash || funds.cash, acc.currency || funds.currency);
          const accountMVHKD = toHKD(acc.marketValue || funds.marketValue, acc.currency || funds.currency);

          const aggPositions: AggregatedPosition[] = (positions || []).map((p: any) => ({
            code: p.code,
            name: p.name || p.code,
            qty: p.qty || 0,
            costPrice: p.costPrice || 0,
            marketPrice: p.marketPrice || 0,
            marketValue: p.marketValue || 0,
            pnl: p.pnl || 0,
            pnlPct: p.pnlPct || 0,
            ratio: accountTotalHKD > 0 ? (p.marketValue || 0) / accountTotalHKD : 0,
          }));

          accounts.push({
            brokerId,
            accountId: acc.accountId,
            name: acc.name || `Account ${acc.accountId}`,
            currency: acc.currency || funds.currency || 'HKD',
            totalAssets: accountTotalHKD,
            cash: accountCashHKD,
            marketValue: accountMVHKD,
            positions: aggPositions,
          });
        }
      } catch (err: any) {
        errors.push({ brokerId, error: err.message || String(err) });
        log.warn(`[RiskEngineV3] Failed to aggregate ${brokerId}: ${err.message}`);
      }
    }

    // Calculate portfolio totals
    const totalAssets = accounts.reduce((sum, a) => sum + a.totalAssets, 0);
    const allPositions = accounts.flatMap(a => a.positions);
    const totalExposure = allPositions.reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
    const netExposure = allPositions.reduce((sum, p) => sum + p.marketValue, 0);
    const leverageRatio = totalAssets > 0 ? totalExposure / totalAssets : 0;

    const result: AggregateResult = {
      success: errors.length === 0,
      portfolio: { totalAssets, totalExposure, netExposure, leverageRatio, accounts },
      errors,
    };

    // Cache result
    this.aggregateCache.set(cacheKey, { data: result, timestamp: now });

    return result;
  }

  // ── V3: Margin Utilization ────────────────────────────────────────────

  async getMarginUtilization(): Promise<MarginResult> {
    const accounts: MarginAccountInfo[] = [];
    const now = Date.now();

    for (const adapter of this.brokerAdapters) {
      const brokerId = adapter.type || 'unknown';
      const cacheKey = brokerId;

      // Check cache
      const cached = this.marginCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < RiskEngineV3.MARGIN_CACHE_TTL) {
        accounts.push(cached.data);
        continue;
      }

      try {
        const accInfos = await adapter.getAccounts();
        const funds = await adapter.getFunds();

        const accountId = accInfos.length > 0 ? accInfos[0].accountId : 'unknown';
        const currency = funds.currency || 'HKD';

        const frozenHKD = toHKD(funds.frozenCash, currency);
        const availableHKD = toHKD(funds.availableCash, currency);
        const totalMargin = (frozenHKD + availableHKD) > 0 ? (frozenHKD + availableHKD) : 1;
        const utilizationRatio = (frozenHKD / totalMargin) * 100;

        let marginCallRisk: 'none' | 'warning' | 'danger' = 'none';
        if (utilizationRatio > 85) {
          marginCallRisk = 'danger';
        } else if (utilizationRatio > 70) {
          marginCallRisk = 'warning';
        }

        const info: MarginAccountInfo = {
          brokerId,
          accountId,
          currency,
          frozenCash: frozenHKD,
          availableCash: toHKD(funds.availableCash, currency),
          totalMargin,
          utilizationRatio: Math.round(utilizationRatio * 100) / 100,
          marginCallRisk,
        };

        accounts.push(info);
        this.marginCache.set(cacheKey, { data: info, timestamp: now });
      } catch (err: any) {
        log.warn(`[RiskEngineV3] Failed to get margin for ${brokerId}: ${err.message}`);
      }
    }

    const anyMarginCallRisk = accounts.some(a => a.marginCallRisk !== 'none');
    const maxUtilization = accounts.length > 0
      ? Math.max(...accounts.map(a => a.utilizationRatio))
      : 0;

    return { accounts, anyMarginCallRisk, maxUtilization };
  }

  // ── V3: Portfolio Exposure ────────────────────────────────────────────

  async getPortfolioExposure(): Promise<PortfolioExposure> {
    const now = Date.now();
    if (this.exposureCache && (now - this.exposureCache.timestamp) < RiskEngineV3.EXPOSURE_CACHE_TTL) {
      return this.exposureCache.data;
    }

    // Aggregate all accounts first
    const allBrokerIds = [...new Set(this.brokerAdapters.map((a: any) => a.type))];
    const agg = await this.aggregateAccounts({ brokerIds: allBrokerIds });

    const allPositions = agg.portfolio.accounts.flatMap(a => a.positions);
    const totalAssets = agg.portfolio.totalAssets;

    const bySector: Record<string, number> = {};
    const byGeography: Record<string, number> = {};
    const byAssetClass: Record<string, number> = {};
    const topPositions: { code: string; name: string; weight: number; marketValue: number }[] = [];

    for (const pos of allPositions) {
      const weight = totalAssets > 0 ? (pos.marketValue / totalAssets) * 100 : 0;
      const code = pos.code;

      // Sector classification
      const sector = this.classifySector(code);
      bySector[sector] = (bySector[sector] || 0) + weight;

      // Geography classification
      const geo = this.classifyGeography(code);
      byGeography[geo] = (byGeography[geo] || 0) + weight;

      // Asset class classification
      const assetClass = this.classifyAssetClass(code);
      byAssetClass[assetClass] = (byAssetClass[assetClass] || 0) + weight;

      topPositions.push({
        code,
        name: pos.name,
        weight: Math.round(weight * 100) / 100,
        marketValue: pos.marketValue,
      });
    }

    // Sort top positions by weight descending
    topPositions.sort((a, b) => b.weight - a.weight);

    // HHI concentration risk (sum of squared weights as percentages, scaled 0-100)
    const weights = allPositions.map(p => totalAssets > 0 ? p.marketValue / totalAssets : 0);
    const hhiRaw = weights.reduce((sum, w) => sum + w * w, 0);
    const concentrationRisk = hhiRaw * 10000; // HHI on 0-10000 scale

    // Round sector/geography/asset class values
    for (const k of Object.keys(bySector)) bySector[k] = Math.round(bySector[k] * 100) / 100;
    for (const k of Object.keys(byGeography)) byGeography[k] = Math.round(byGeography[k] * 100) / 100;
    for (const k of Object.keys(byAssetClass)) byAssetClass[k] = Math.round(byAssetClass[k] * 100) / 100;

    const result: PortfolioExposure = {
      bySector,
      byGeography,
      byAssetClass,
      topPositions,
      concentrationRisk,
    };

    this.exposureCache = { data: result, timestamp: now };
    return result;
  }

  // ── V3: Circuit Breaker ───────────────────────────────────────────────

  async checkCircuitBreaker(market: string): Promise<CircuitBreakerResult> {
    const now = Date.now();

    // Check cache
    const cached = this.circuitBreakerCache.get(market);
    if (cached && (now - cached.timestamp) < RiskEngineV3.CIRCUIT_BREAKER_CACHE_TTL) {
      return cached.data;
    }

    const indexCode = MARKET_INDEX_CODES[market];
    if (!indexCode) {
      const result: CircuitBreakerResult = {
        market,
        status: 'open',
        triggerLevel: 0,
      };
      this.circuitBreakerCache.set(market, { data: result, timestamp: now });
      return result;
    }

    // Find adapter that can provide this quote
    let quote: any = null;
    for (const adapter of this.brokerAdapters) {
      try {
        const quotes = await adapter.getQuotes();
        const found = (quotes || []).find((q: any) => q.code === indexCode);
        if (found) {
          quote = found;
          break;
        }
      } catch {
        // try next adapter
      }
    }

    if (!quote) {
      const result: CircuitBreakerResult = {
        market,
        status: 'open',
        triggerLevel: 0,
        cachedAt: now,
      };
      this.circuitBreakerCache.set(market, { data: result, timestamp: now });
      return result;
    }

    const changePct = quote.changePct;
    let status: 'open' | 'resume_pending' | 'halted' = 'open';
    let triggerLevel = 0;
    let reason: string | undefined;

    if (market === 'HK') {
      // HK market: HSI-based circuit breaker
      if (changePct <= -10) {
        status = 'halted';
        triggerLevel = 2;
        reason = `HSI dropped ${Math.abs(changePct).toFixed(1)}% — Level 2 circuit breaker triggered`;
      } else if (changePct <= -5) {
        status = 'resume_pending';
        triggerLevel = 1;
        reason = `HSI dropped ${Math.abs(changePct).toFixed(1)}% — Level 1 cooling period`;
      }
    } else if (market === 'US') {
      // US market: S&P 500-based circuit breaker
      if (changePct <= -20) {
        status = 'halted';
        triggerLevel = 3;
        reason = `S&P 500 dropped ${Math.abs(changePct).toFixed(1)}% — Level 3 circuit breaker`;
      } else if (changePct <= -13) {
        status = 'halted';
        triggerLevel = 2;
        reason = `S&P 500 dropped ${Math.abs(changePct).toFixed(1)}% — Level 2 circuit breaker`;
      } else if (changePct <= -7) {
        status = 'resume_pending';
        triggerLevel = 1;
        reason = `S&P 500 dropped ${Math.abs(changePct).toFixed(1)}% — Level 1 circuit breaker`;
      }
    } else if (market === 'CN') {
      // CN market: CSI 300-based
      if (changePct <= -10) {
        status = 'halted';
        triggerLevel = 2;
        reason = `CSI 300 dropped ${Math.abs(changePct).toFixed(1)}% — Level 2 circuit breaker`;
      } else if (changePct <= -5) {
        status = 'resume_pending';
        triggerLevel = 1;
        reason = `CSI 300 dropped ${Math.abs(changePct).toFixed(1)}% — Level 1 circuit breaker`;
      }
    }

    const result: CircuitBreakerResult = {
      market,
      status,
      triggerLevel,
      reason,
      indexCode,
      changePct,
      cachedAt: now,
    };

    this.circuitBreakerCache.set(market, { data: result, timestamp: now });
    return result;
  }

  // ── V3: Cache Management ──────────────────────────────────────────────

  invalidateCache(): void {
    this.aggregateCache.clear();
    this.marginCache.clear();
    this.circuitBreakerCache.clear();
    this.exposureCache = null;
    log.info('[RiskEngineV3] All caches invalidated');
  }

  getBaseEngine(): any {
    return this.baseEngine;
  }

  // ── Classification Helpers ────────────────────────────────────────────

  private classifySector(code: string): string {
    // Internet companies
    if (code === 'HK.00700' || code === 'HK.09988' || code === 'HK.03690' ||
        code === 'HK.09618' || code === 'HK.01024' || code === 'HK.09888') {
      return 'Internet';
    }
    // Commodity
    if (code.startsWith('US.GLD') || code.startsWith('US.SLV') || code.startsWith('US.GDX') ||
        code.includes('GLD') || code.includes('SLV')) {
      return 'Commodity';
    }
    // Financial
    if (code.startsWith('US.JPM') || code.startsWith('US.GS') || code.startsWith('US.BAC') ||
        code.startsWith('HK.00005') || code.startsWith('HK.01398') || code.startsWith('HK.00939')) {
      return 'Financial';
    }
    // Energy
    if (code.startsWith('US.XOM') || code.startsWith('US.CVX') || code.startsWith('US.XLE')) {
      return 'Energy';
    }
    // Default: Technology
    return 'Technology';
  }

  private classifyGeography(code: string): string {
    if (code.startsWith('HK.')) return 'HK';
    if (code.startsWith('US.')) return 'US';
    if (code.startsWith('CN.') || code.startsWith('SH.') || code.startsWith('SZ.')) return 'CN';
    if (code.startsWith('SG.')) return 'SG';
    if (code.startsWith('JP.')) return 'JP';
    if (code.startsWith('UK.') || code.startsWith('LSE.')) return 'UK';
    return 'Other';
  }

  private classifyAssetClass(code: string): string {
    if (KNOWN_ETFS.has(code)) return 'ETF';
    // Common ETF patterns
    if (/^US\.[A-Z]{2,5}$/.test(code) && KNOWN_ETFS.has(code)) return 'ETF';
    return 'Stock';
  }

  // ── Internal Risk Calculators ─────────────────────────────────────────

  private calculateDrawdownRisk(marketData: MarketData): number {
    const { historicalPrices } = marketData;
    if (historicalPrices.length < 2) return 0;

    let maxPrice = historicalPrices[0];
    let maxDrawdown = 0;

    for (const price of historicalPrices) {
      if (price > maxPrice) {
        maxPrice = price;
      }
      const drawdown = (maxPrice - price) / maxPrice;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const drawdownPct = maxDrawdown * 100;
    const riskScore = (drawdownPct / this.thresholds.drawdown) * 100;
    return Math.min(100, Math.max(0, riskScore));
  }

  private calculateVolatilityRisk(marketData: MarketData): number {
    const { returns } = marketData;
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

    const riskScore = (volatility / this.thresholds.volatility) * 100;
    return Math.min(100, Math.max(0, riskScore));
  }

  private calculateConcentrationRisk(portfolio: PortfolioPosition[]): number {
    if (portfolio.length === 0) return 0;

    const maxWeight = Math.max(...portfolio.map(p => p.weight));
    const riskScore = (maxWeight / (this.thresholds.concentration / 100)) * 100;
    return Math.min(100, Math.max(0, riskScore));
  }

  private calculateCorrelationRisk(portfolio: PortfolioPosition[], marketData: MarketData): number {
    if (portfolio.length < 2) return 0;

    const avgCorrelation = 0.5;
    const riskScore = (avgCorrelation / this.thresholds.correlation) * 100;
    return Math.min(100, Math.max(0, riskScore));
  }

  private checkThresholds(score: RiskScore): void {
    const timestamp = score.timestamp;

    if (score.drawdown > this.thresholds.drawdown) {
      this.addAlert({
        type: 'drawdown',
        severity: this.getSeverity(score.drawdown, this.thresholds.drawdown),
        message: `Portfolio drawdown ${score.drawdown.toFixed(2)}% exceeds threshold ${this.thresholds.drawdown}%`,
        value: score.drawdown,
        threshold: this.thresholds.drawdown,
        timestamp,
      });
    }

    if (score.volatility > this.thresholds.volatility) {
      this.addAlert({
        type: 'volatility',
        severity: this.getSeverity(score.volatility, this.thresholds.volatility),
        message: `Portfolio volatility ${score.volatility.toFixed(2)}% exceeds threshold ${this.thresholds.volatility}%`,
        value: score.volatility,
        threshold: this.thresholds.volatility,
        timestamp,
      });
    }

    if (score.concentration > this.thresholds.concentration) {
      this.addAlert({
        type: 'concentration',
        severity: this.getSeverity(score.concentration, this.thresholds.concentration),
        message: `Portfolio concentration ${score.concentration.toFixed(2)}% exceeds threshold ${this.thresholds.concentration}%`,
        value: score.concentration,
        threshold: this.thresholds.concentration,
        timestamp,
      });
    }

    if (score.correlation > this.thresholds.correlation) {
      this.addAlert({
        type: 'correlation',
        severity: this.getSeverity(score.correlation, this.thresholds.correlation),
        message: `Portfolio correlation ${score.correlation.toFixed(2)} exceeds threshold ${this.thresholds.correlation}`,
        value: score.correlation,
        threshold: this.thresholds.correlation,
        timestamp,
      });
    }
  }

  private getSeverity(value: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = value / threshold;
    if (ratio < 1.1) return 'low';
    if (ratio < 1.2) return 'medium';
    if (ratio < 1.5) return 'high';
    return 'critical';
  }

  private addAlert(alert: RiskAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > this.maxAlertsSize) {
      this.alerts.shift();
    }
    this.emit('alert', alert);
    log.warn(`[RiskEngineV3] Alert: ${alert.type} - ${alert.message}`);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: RiskEngineV3 | null = null;

export function getRiskEngineV3(): RiskEngineV3 {
  if (!_instance) {
    _instance = new RiskEngineV3();
  }
  return _instance;
}

export function resetRiskEngineV3(): void {
  if (_instance) {
    _instance.reset();
    _instance.removeAllListeners();
    _instance = null;
  }
}

export default RiskEngineV3;
