// ── Risk Engine v3 — Multi-Broker Risk Aggregation ────────────────────────────
// Phase 1: 多券商账户聚合 + 保证金监控 + 敞口分析 + 熔断检测
// 向后兼容: RiskEngine v2 所有接口保持不变，新增 RiskEngineV3 类

import log from 'electron-log';
import { IBrokerAdapter, FundsInfo, PositionInfo } from '../broker/IBrokerAdapter';
import { RiskEngine } from './risk-engine';

// ── Types ──────────────────────────────────────────────────────────────────

/** 单个账户快照 */
export interface AccountSnapshot {
  brokerId: string;
  brokerName: string;
  accountId: string;
  totalAssets: number;     // HKD 折算
  cash: number;
  marketValue: number;
  frozenCash: number;
  availableCash: number;
  positions: PositionSnapshot[];
  currency: string;
  updatedAt: number;        // unix ms
}

/** 持仓快照 */
export interface PositionSnapshot {
  code: string;
  name: string;
  qty: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;      // HKD 折算
  pnl: number;
  pnlPct: number;
  ratio: number;            // 占总资产比例
  sector: string;
  geography: string;
}

/** 多券商组合视图 */
export interface AggregatedPortfolio {
  accounts: AccountSnapshot[];
  totalAssets: number;
  totalMarketValue: number;
  totalCash: number;
  totalExposure: number;    // 多头 + 空头绝对值
  netExposure: number;      // 多头 - 空头
  leverageRatio: number;    // totalExposure / totalAssets
}

/** 账户查询请求 */
export interface AggregateAccountsRequest {
  brokerIds: string[];
  accountIds?: string[];
  forceRefresh?: boolean;
}

/** 账户聚合结果 */
export interface AggregateAccountsResult {
  success: boolean;
  portfolio: AggregatedPortfolio;
  errors: Array<{ brokerId: string; error: string }>;
  cachedAt?: number;
}

/** 保证金状态 */
export interface MarginResult {
  brokerId: string;
  accountId: string;
  marginUsed: number;
  marginAvailable: number;
  marginTotal: number;
  utilizationRatio: number;
  marginCallRisk: 'none' | 'warning' | 'danger';
  marginCallLevel: number;
  unrealizedPnl: number;
  currency: string;
}

/** 组合保证金总览 */
export interface PortfolioMarginResult {
  accounts: MarginResult[];
  totalMarginUsed: number;
  totalMarginAvailable: number;
  maxUtilization: number;
  anyMarginCallRisk: boolean;
}

/** 敞口分布 */
export interface ExposureResult {
  bySector: Record<string, number>;
  byGeography: Record<string, number>;
  byAssetClass: Record<string, number>;
  byMarket: Record<string, number>;
  topPositions: Array<{ code: string; name: string; weight: number; pnl: number }>;
  concentrationRisk: number;   // HHI 指数
}

/** 熔断状态 */
export interface CircuitBreakerResult {
  market: string;
  status: 'open' | 'halted' | 'resume_pending';
  triggerLevel: number;
  triggerPrice?: number;
  haltedAt?: number;
  resumeAt?: number;
  reason?: string;
}

// ── Circuit Breaker Rules ─────────────────────────────────────────────────

const CIRCUIT_BREAKER_RULES: Record<string, { L1: number; L2: number; L3: number }> = {
  HK: { L1: 0.05, L2: 0.10, L3: 0.20 },   // 恒生指数跌幅
  US: { L1: 0.07, L2: 0.13, L3: 0.20 },    // S&P500
  CN: { L1: 0.05, L2: 0.07, L3: 0.10 },   // 沪深300
};

// ── Currency Conversion ───────────────────────────────────────────────────

const FX_RATES_TO_HKD: Record<string, number> = {
  HKD: 1.0,
  USD: 7.78,
  SGD: 5.78,
  CNY: 1.07,
  EUR: 8.42,
  GBP: 9.71,
  JPY: 0.051,
};

function toHKD(amount: number, currency: string): number {
  const rate = FX_RATES_TO_HKD[currency] ?? 1.0;
  return amount * rate;
}

// ── Sector / Geography Mapping ────────────────────────────────────────────

// 手动标的名字 → 板块/地区 映射表
const SECTOR_MAP: Record<string, string> = {
  // 科技
  // 互联网
  'HK.00700': 'Internet',
  'US.AAPL': 'Technology',
  'US.NVDA': 'Technology',
  'US.MSFT': 'Technology',
  'US.GOOG': 'Technology',
  'US.META': 'Technology',
  'US.AMD': 'Technology',
  'US.PLTR': 'Technology',
  // 互联网
  'US.BABA': 'Internet',
  'US.PDD': 'Internet',
  'US.AMZN': 'Internet',
  'US.TSLA': 'EV/Auto',
  // 金融
  'HK.00001': 'Finance',
  'HK.02318': 'Finance',
  // 半导体
  'US.SOXL': 'Semiconductor',
  'US.SOXS': 'Semiconductor',
  // 指数ETF
  'US.QQQ': 'Index',
  'US.SPY': 'Index',
  'US.TQQQ': 'Index',
  'US.SQQQ': 'Index',
  'US.IWM': 'Index',
  // 债券/商品
  'US.TLT': 'Bonds',
  'US.GLD': 'Commodity',
  'US.UVXY': 'Volatility',
  'US.ARKK': 'Innovation',
  // 港股
  'HK.07552': 'Technology',
};

const GEO_MAP: Record<string, string> = {
  'HK.': 'HK',
  'US.': 'US',
  'CN.': 'CN',
  'SZ.': 'CN',
  'SH.': 'CN',
};

function getSector(code: string): string {
  return SECTOR_MAP[code] ?? 'Other';
}

function getGeography(code: string): string {
  for (const [prefix, geo] of Object.entries(GEO_MAP)) {
    if (code.startsWith(prefix)) return geo;
  }
  return 'Other';
}

// ── Cache ─────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_CACHE_TTL_MS = 30_000; // 30s

// ── RiskEngine v3 ────────────────────────────────────────────────────────

export class RiskEngineV3 {
  private adapters: Map<string, IBrokerAdapter> = new Map();
  private baseEngine: RiskEngine;
  private portfolioCache: CacheEntry<AggregatedPortfolio> | null = null;
  private marginCache: CacheEntry<PortfolioMarginResult> | null = null;
  private exposureCache: CacheEntry<ExposureResult> | null = null;
  private circuitCache: CacheEntry<CircuitBreakerResult> | null = null;

  constructor(adapters: IBrokerAdapter[], baseEngine: RiskEngine) {
    this.baseEngine = baseEngine;
    for (const adapter of adapters) {
      this.adapters.set(adapter.type, adapter);
    }
  }

  // ── aggregateAccounts ────────────────────────────────────────────────

  async aggregateAccounts(req: AggregateAccountsRequest): Promise<AggregateAccountsResult> {
    const { brokerIds, forceRefresh = false } = req;

    // Check cache
    if (!forceRefresh && this.portfolioCache) {
      const age = Date.now() - this.portfolioCache.timestamp;
      if (age < DEFAULT_CACHE_TTL_MS) {
        return {
          success: true,
          portfolio: this.portfolioCache.data,
          errors: [],
          cachedAt: this.portfolioCache.timestamp,
        };
      }
    }

    const errors: Array<{ brokerId: string; error: string }> = [];
    const accountSnapshots: AccountSnapshot[] = [];

    await Promise.all(
      brokerIds.map(async (brokerId) => {
        const adapter = this.adapters.get(brokerId);
        if (!adapter) {
          errors.push({ brokerId, error: `Adapter not found: ${brokerId}` });
          return;
        }

        try {
          const accounts = await adapter.getAccounts();
          await Promise.all(
            accounts.map(async (account) => {
              const funds = await adapter.getFunds(account.accountId);
              const positions = await adapter.getPositions(account.accountId);

              const positionsSnapshot: PositionSnapshot[] = positions.map((p) => ({
                code: p.code,
                name: p.name,
                qty: p.qty,
                costPrice: p.costPrice,
                marketPrice: p.marketPrice,
                marketValue: toHKD(p.marketValue, account.currency),
                pnl: toHKD(p.pnl, account.currency),
                pnlPct: p.pnlPct,
                ratio: 0, // computed below
                sector: getSector(p.code),
                geography: getGeography(p.code),
              }));

              const totalHkd = toHKD(funds.totalAssets, funds.currency);

              // Compute ratio
              for (const pos of positionsSnapshot) {
                pos.ratio = totalHkd > 0 ? pos.marketValue / totalHkd : 0;
              }

              accountSnapshots.push({
                brokerId,
                brokerName: adapter.name,
                accountId: account.accountId,
                totalAssets: totalHkd,
                cash: toHKD(funds.cash, funds.currency),
                marketValue: toHKD(funds.marketValue, funds.currency),
                frozenCash: toHKD(funds.frozenCash, funds.currency),
                availableCash: toHKD(funds.availableCash, funds.currency),
                positions: positionsSnapshot,
                currency: funds.currency,
                updatedAt: Date.now(),
              });
            })
          );
        } catch (err: any) {
          errors.push({ brokerId, error: err?.message ?? String(err) });
        }
      })
    );

    // Compute aggregated portfolio
    const totalAssets = accountSnapshots.reduce((sum, a) => sum + a.totalAssets, 0);
    const totalMarketValue = accountSnapshots.reduce((sum, a) => sum + a.marketValue, 0);
    const totalCash = accountSnapshots.reduce((sum, a) => sum + a.cash, 0);

    // Total exposure: sum of absolute position market values
    const totalExposure = accountSnapshots.reduce(
      (sum, a) => sum + a.positions.reduce((ps, p) => ps + Math.abs(p.marketValue), 0),
      0
    );

    const netExposure = accountSnapshots.reduce(
      (sum, a) => sum + a.positions.reduce((ps, p) => ps + p.marketValue, 0),
      0
    );

    const leverageRatio = totalAssets > 0 ? totalExposure / totalAssets : 0;

    const portfolio: AggregatedPortfolio = {
      accounts: accountSnapshots,
      totalAssets,
      totalMarketValue,
      totalCash,
      totalExposure,
      netExposure,
      leverageRatio,
    };

    // Cache result
    this.portfolioCache = { data: portfolio, timestamp: Date.now() };

    return {
      success: errors.length === 0,
      portfolio,
      errors,
    };
  }

  // ── getMarginUtilization ─────────────────────────────────────────────

  async getMarginUtilization(): Promise<PortfolioMarginResult> {
    const cacheAge = this.marginCache ? Date.now() - this.marginCache.timestamp : Infinity;
    if (cacheAge < DEFAULT_CACHE_TTL_MS && this.marginCache) {
      return this.marginCache.data;
    }

    const results: MarginResult[] = [];
    let maxUtilization = 0;

    await Promise.all(
      Array.from(this.adapters.entries()).map(async ([brokerId, adapter]) => {
        try {
          const accounts = await adapter.getAccounts();
          await Promise.all(
            accounts.map(async (account) => {
              const funds: FundsInfo = await adapter.getFunds(account.accountId);

              const marginUsed = toHKD(funds.frozenCash, funds.currency);
              const marginAvailable = toHKD(funds.availableCash, funds.currency);
              const marginTotal = marginUsed + marginAvailable;
              const utilizationRatio = marginTotal > 0 ? marginUsed / marginTotal : 0;

              if (utilizationRatio > maxUtilization) {
                maxUtilization = utilizationRatio;
              }

              let marginCallRisk: MarginResult['marginCallRisk'] = 'none';
              if (utilizationRatio >= 0.85) marginCallRisk = 'danger';
              else if (utilizationRatio >= 0.70) marginCallRisk = 'warning';

              results.push({
                brokerId,
                accountId: account.accountId,
                marginUsed,
                marginAvailable,
                marginTotal,
                utilizationRatio: Math.round(utilizationRatio * 10000) / 100,
                marginCallRisk,
                marginCallLevel: marginCallRisk === 'danger' ? 0.85 : marginCallRisk === 'warning' ? 0.70 : 0,
                unrealizedPnl: toHKD(funds.marketValue - funds.costPrice, funds.currency),
                currency: funds.currency,
              });
            })
          );
        } catch {
          // skip failed adapters
        }
      })
    );

    const totalMarginUsed = results.reduce((sum, r) => sum + r.marginUsed, 0);
    const totalMarginAvailable = results.reduce((sum, r) => sum + r.marginAvailable, 0);
    const anyMarginCallRisk = results.some((r) => r.marginCallRisk !== 'none');

    const result: PortfolioMarginResult = {
      accounts: results,
      totalMarginUsed,
      totalMarginAvailable,
      maxUtilization: Math.round(maxUtilization * 10000) / 100,
      anyMarginCallRisk,
    };

    this.marginCache = { data: result, timestamp: Date.now() };
    return result;
  }

  // ── getPortfolioExposure ─────────────────────────────────────────────

  async getPortfolioExposure(): Promise<ExposureResult> {
    const cacheAge = this.exposureCache ? Date.now() - this.exposureCache.timestamp : Infinity;
    if (cacheAge < DEFAULT_CACHE_TTL_MS && this.exposureCache) {
      return this.exposureCache.data;
    }

    // Get fresh portfolio if available
    let portfolio: AggregatedPortfolio;
    if (this.portfolioCache) {
      portfolio = this.portfolioCache.data;
    } else {
      // Aggregate without cache
      const result = await this.aggregateAccounts({
        brokerIds: Array.from(this.adapters.keys()),
        forceRefresh: true,
      });
      portfolio = result.portfolio;
    }

    const bySector: Record<string, number> = {};
    const byGeography: Record<string, number> = {};
    const byAssetClass: Record<string, number> = {};
    const byMarket: Record<string, number> = {};
    const topPositions: ExposureResult['topPositions'] = [];

    let totalWeightedPnl = 0;
    let totalPositionValue = 0;

    for (const account of portfolio.accounts) {
      for (const pos of account.positions) {
        const value = pos.marketValue;
        const weight = portfolio.totalAssets > 0 ? value / portfolio.totalAssets : 0;

        // Sector
        bySector[pos.sector] = (bySector[pos.sector] ?? 0) + weight;

        // Geography
        byGeography[pos.geography] = (byGeography[pos.geography] ?? 0) + weight;

        // Asset class
        const assetClass = this.classifyAssetClass(pos.code);
        byAssetClass[assetClass] = (byAssetClass[assetClass] ?? 0) + weight;

        // Market
        byMarket[pos.geography] = (byMarket[pos.geography] ?? 0) + weight;

        topPositions.push({
          code: pos.code,
          name: pos.name,
          weight: Math.round(weight * 10000) / 100,
          pnl: pos.pnl,
        });

        totalWeightedPnl += pos.pnl * weight;
        totalPositionValue += value;
      }
    }

    // Sort top positions by weight descending, keep top 10
    topPositions.sort((a, b) => b.weight - a.weight);
    const top10 = topPositions.slice(0, 10);

    // HHI concentration risk: sum of squared weights
    const hhi = Object.values(bySector).reduce((sum, w) => sum + w * w, 0);

    const result: ExposureResult = {
      bySector: this.roundRecord(bySector),
      byGeography: this.roundRecord(byGeography),
      byAssetClass: this.roundRecord(byAssetClass),
      byMarket: this.roundRecord(byMarket),
      topPositions: top10,
      concentrationRisk: Math.round(hhi * 10000) / 100,
    };

    this.exposureCache = { data: result, timestamp: Date.now() };
    return result;
  }

  // ── checkCircuitBreaker ──────────────────────────────────────────────

  async checkCircuitBreaker(market: string): Promise<CircuitBreakerResult> {
    const cacheAge = this.circuitCache ? Date.now() - this.circuitCache.timestamp : Infinity;
    if (cacheAge < 60_000 && this.circuitCache && this.circuitCache.data.market === market) {
      return this.circuitCache.data;
    }

    const rules = CIRCUIT_BREAKER_RULES[market];
    if (!rules) {
      return {
        market,
        status: 'open',
        triggerLevel: 0,
        reason: `Unknown market: ${market}`,
      };
    }

    // Get market index price from first available broker
    let currentIndexPrice = 0;
    let previousIndexPrice = 0;

    try {
      const adapter = Array.from(this.adapters.values())[0];
      if (adapter) {
        // Try to get a proxy index quote (e.g. HS50 for HK, US30 for US)
        const indexMap: Record<string, string> = {
          HK: 'HK.HSI',
          US: 'US.SPX',
          CN: 'CN.000001',
        };
        const indexCode = indexMap[market];
        if (indexCode) {
          const quotes = await adapter.getQuotes([indexCode]);
          if (quotes[0]) {
            currentIndexPrice = quotes[0].price;
            previousIndexPrice = quotes[0].prevClose;
          }
        }
      }
    } catch {
      // Index fetch failed — circuit breaker cannot be determined
    }

    let status: CircuitBreakerResult['status'] = 'open';
    let triggerLevel = 0;
    let reason = 'Market operating normally';

    if (currentIndexPrice > 0 && previousIndexPrice > 0) {
      const decline = (previousIndexPrice - currentIndexPrice) / previousIndexPrice;

      if (decline >= rules.L3) {
        status = 'halted';
        triggerLevel = 3;
        reason = `${market} index down ${(decline * 100).toFixed(1)}% — Level 3 circuit breaker triggered`;
      } else if (decline >= rules.L2) {
        status = 'halted';
        triggerLevel = 2;
        reason = `${market} index down ${(decline * 100).toFixed(1)}% — Level 2 circuit breaker triggered`;
      } else if (decline >= rules.L1) {
        status = 'resume_pending';
        triggerLevel = 1;
        reason = `${market} index down ${(decline * 100).toFixed(1)}% — Level 1 circuit breaker warning`;
      }
    }

    const result: CircuitBreakerResult = {
      market,
      status,
      triggerLevel,
      triggerPrice: currentIndexPrice > 0 ? currentIndexPrice : undefined,
      haltedAt: status === 'halted' ? Date.now() : undefined,
      reason,
    };

    this.circuitCache = { data: result, timestamp: Date.now() };
    return result;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private classifyAssetClass(code: string): string {
    if (code.startsWith('HK.')) return 'Stock';
    if (code.startsWith('US.')) {
      const sym = code.replace('US.', '');
      if (['QQQ', 'SPY', 'TQQQ', 'SQQQ', 'IWM', 'TLT', 'GLD'].includes(sym)) return 'ETF';
      return 'Stock';
    }
    return 'Other';
  }

  private roundRecord(record: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] = Math.round(v * 10000) / 100; // percentage with 2 decimal places
    }
    return out;
  }

  /** Invalidate all caches (call when market data changes significantly) */
  invalidateCache(): void {
    this.portfolioCache = null;
    this.marginCache = null;
    this.exposureCache = null;
    this.circuitCache = null;
    log.info('[RiskEngineV3] All caches invalidated');
  }

  /** Get underlying v2 engine for backward compatibility */
  getBaseEngine(): RiskEngine {
    return this.baseEngine;
  }
}
