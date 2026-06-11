// ── Data Provider Service — ──────────────────────────────────
// interface/API， futu-api + + 
// strategy/policy： + fundamental + capital flow + regime + 
//
// ：
// 1. futu-api data source（/K/）
// 2. data source（financial report//capital flow direction/）
// 3. local SQLite cache，
// 4. interface/API，strategy/policy

import log from 'electron-log';
import i18n from '../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FundamentalData {
  symbol: string;
  pe: number | null;             // P/E ratio
  pb: number | null;             // P/B ratio
  marketCap: number | null;      // market cap (亿)
  revenue: number | null;        // revenue (亿)
  netProfit: number | null;      // net profit (亿)
  roe: number | null;            // 净资产收益率
  debtRatio: number | null;      // 资产负债率
  revenueGrowth: number | null;  // revenue增长率
  profitGrowth: number | null;   // 利润增长率
  updatedAt: number;
}

export interface CapitalFlowData {
  symbol: string;
  mainNetInflow: number | null;  // major player净流入 (万)
  superLargeIn: number | null;   // 超大单流入
  largeIn: number | null;        // 大单流入
  mediumIn: number | null;       // 中单流入
  smallIn: number | null;        // 小单流入
  updatedAt: number;
}

export interface AnomalySignal {
  symbol: string;
  type: 'capital' | 'technical' | 'derivatives' | 'sentiment';
  level: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: number;
}

export interface MarketRegime {
  state: 'bull' | 'bear' | 'sideways' | 'volatile' | 'unknown';
  confidence: number;     // 0-1
  factors: {
    gdpGrowth: number | null;
    cpi: number | null;
    interestRate: number | null;
    vix: number | null;
    marketSentiment: string;
  };
  recommendation: string;
  updatedAt: number;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishTime: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  summary?: string;
}

export interface StockDigest {
  symbol: string;
  keyEvents: string[];
  impactDirection: 'positive' | 'negative' | 'mixed';
  evidenceLinks: string[];
  generatedAt: number;
}

// ── Data Provider Service ──────────────────────────────────────────────────

export class DataProviderService {
 // cache TTL 
  private static FUNDAMENTAL_TTL = 24 * 60 * 60 * 1000;    // 24h（financial report不常变）
  private static CAPITAL_FLOW_TTL = 5 * 60 * 1000;          // 5min
  private static REGIME_TTL = 60 * 60 * 1000;               // 1h
  private static ANOMALY_TTL = 15 * 60 * 1000;              // 15min
  private static NEWS_TTL = 30 * 60 * 1000;                 // 30min

  // memorycache
  private fundamentalCache = new Map<string, { data: FundamentalData; expires: number }>();
  private capitalFlowCache = new Map<string, { data: CapitalFlowData; expires: number }>();
  private regimeCache: { data: MarketRegime; expires: number } | null = null;
  private anomalyCache = new Map<string, { data: AnomalySignal[]; expires: number }>();
  private newsCache = new Map<string, { data: NewsItem[]; expires: number }>();

 // database（ DatabaseManager ）
  private db: unknown = null;

  initialize(db: unknown): void {
    this.db = db;
    this.createTables();
    log.info('[DataProvider] Initialized with multi-source integration');
  }

  private createTables(): void {
    if (!this.db) return;
    this.db.exec(`
      ${i18n.t('DataProvider.k0')}
      CREATE TABLE IF NOT EXISTS fundamental_cache (
        symbol TEXT PRIMARY KEY,
        pe REAL,
        pb REAL,
        market_cap REAL,
        revenue REAL,
        net_profit REAL,
        roe REAL,
        debt_ratio REAL,
        revenue_growth REAL,
        profit_growth REAL,
        updated_at INTEGER NOT NULL
      );

      ${i18n.t('DataProvider.k1')}
      CREATE TABLE IF NOT EXISTS capital_flow_cache (
        symbol TEXT PRIMARY KEY,
        main_net_inflow REAL,
        super_large_in REAL,
        large_in REAL,
        medium_in REAL,
        small_in REAL,
        updated_at INTEGER NOT NULL
      );

      ${i18n.t('DataProvider.k2')}
      CREATE TABLE IF NOT EXISTS market_regime (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL DEFAULT 'unknown',
        confidence REAL DEFAULT 0,
        factors_json TEXT,
        recommendation TEXT,
        updated_at INTEGER NOT NULL
      );

      ${i18n.t('DataProvider.k3')}
      CREATE TABLE IF NOT EXISTS anomaly_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        details_json TEXT,
        created_at INTEGER NOT NULL
      );

      ${i18n.t('DataProvider.k4')}
      CREATE TABLE IF NOT EXISTS news_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        title TEXT NOT NULL,
        source TEXT,
        url TEXT,
        publish_time INTEGER NOT NULL,
        sentiment TEXT DEFAULT 'neutral',
        summary TEXT,
        fetched_at INTEGER NOT NULL
      );

      ${i18n.t('DataProvider.k5')}
      CREATE INDEX IF NOT EXISTS idx_anomaly_symbol ON anomaly_signals(symbol);
      CREATE INDEX IF NOT EXISTS idx_anomaly_time ON anomaly_signals(created_at);
      CREATE INDEX IF NOT EXISTS idx_news_symbol ON news_cache(symbol);
      CREATE INDEX IF NOT EXISTS idx_news_time ON news_cache(publish_time);
    `);
  }

 // ── fundamental ──────────────────────────────────────────────────

  /**
 * fundamental。
 * memorycache → SQLite → API 
   */
  async getFundamental(symbol: string): Promise<FundamentalData | null> {
    const now = Date.now();

    // 1. memorycache
    const cached = this.fundamentalCache.get(symbol);
    if (cached && cached.expires > now) {
      return cached.data;
    }

    // 2. SQLite cache
    if (this.db) {
      const row = this.db.prepare(
        'SELECT * FROM fundamental_cache WHERE symbol = ? AND updated_at > ?'
      ).get(symbol, now - DataProviderService.FUNDAMENTAL_TTL) as any;

      if (row) {
        const data: FundamentalData = {
          symbol: row.symbol,
          pe: row.pe,
          pb: row.pb,
          marketCap: row.market_cap,
          revenue: row.revenue,
          netProfit: row.net_profit,
          roe: row.roe,
          debtRatio: row.debt_ratio,
          revenueGrowth: row.revenue_growth,
          profitGrowth: row.profit_growth,
          updatedAt: row.updated_at,
        };
        this.fundamentalCache.set(symbol, { data, expires: row.updated_at + DataProviderService.FUNDAMENTAL_TTL });
        return data;
      }
    }

 // 3. back null（refreshmodule）
    log.info(`[DataProvider] Fundamental cache miss: ${symbol}`);
    return null;
  }

  /**
 * savefundamentalcache（refreshmodule）
   */
  saveFundamental(data: FundamentalData): void {
    data.updatedAt = Date.now();
    this.fundamentalCache.set(data.symbol, {
      data,
      expires: Date.now() + DataProviderService.FUNDAMENTAL_TTL,
    });

    if (this.db) {
      this.db.prepare(`
        INSERT OR REPLACE INTO fundamental_cache
        (symbol, pe, pb, market_cap, revenue, net_profit, roe, debt_ratio, revenue_growth, profit_growth, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.symbol, data.pe, data.pb, data.marketCap,
        data.revenue, data.netProfit, data.roe, data.debtRatio,
        data.revenueGrowth, data.profitGrowth, data.updatedAt,
      );
    }
  }

 // ── capital flow ──────────────────────────────────────────────────

  async getCapitalFlow(symbol: string): Promise<CapitalFlowData | null> {
    const now = Date.now();

    const cached = this.capitalFlowCache.get(symbol);
    if (cached && cached.expires > now) return cached.data;

    if (this.db) {
      const row = this.db.prepare(
        'SELECT * FROM capital_flow_cache WHERE symbol = ? AND updated_at > ?'
      ).get(symbol, now - DataProviderService.CAPITAL_FLOW_TTL) as any;

      if (row) {
        const data: CapitalFlowData = {
          symbol: row.symbol,
          mainNetInflow: row.main_net_inflow,
          superLargeIn: row.super_large_in,
          largeIn: row.large_in,
          mediumIn: row.medium_in,
          smallIn: row.small_in,
          updatedAt: row.updated_at,
        };
        this.capitalFlowCache.set(symbol, { data, expires: row.updated_at + DataProviderService.CAPITAL_FLOW_TTL });
        return data;
      }
    }

    return null;
  }

  saveCapitalFlow(data: CapitalFlowData): void {
    data.updatedAt = Date.now();
    this.capitalFlowCache.set(data.symbol, {
      data,
      expires: Date.now() + DataProviderService.CAPITAL_FLOW_TTL,
    });

    if (this.db) {
      this.db.prepare(`
        INSERT OR REPLACE INTO capital_flow_cache
        (symbol, main_net_inflow, super_large_in, large_in, medium_in, small_in, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.symbol, data.mainNetInflow, data.superLargeIn,
        data.largeIn, data.mediumIn, data.smallIn, data.updatedAt,
      );
    }
  }

 // ── Regime ──────────────────────────────────────────

  /**
 * current（bull/bear/sideways/volatile）
 * + VIX + 
   */
  async getMarketRegime(): Promise<MarketRegime> {
    const now = Date.now();

    if (this.regimeCache && this.regimeCache.expires > now) {
      return this.regimeCache.data;
    }

 // SQLite 
    if (this.db) {
      const row = this.db.prepare(
        'SELECT * FROM market_regime WHERE id = 1 AND updated_at > ?'
      ).get(now - DataProviderService.REGIME_TTL) as any;

      if (row) {
        const regime: MarketRegime = {
          state: row.state,
          confidence: row.confidence,
          factors: JSON.parse(row.factors_json || '{}'),
          recommendation: row.recommendation || '',
          updatedAt: row.updated_at,
        };
        this.regimeCache = { data: regime, expires: row.updated_at + DataProviderService.REGIME_TTL };
        return regime;
      }
    }

 // default
    return {
      state: 'unknown',
      confidence: 0,
      factors: { gdpGrowth: null, cpi: null, interestRate: null, vix: null, marketSentiment: '' },
      recommendation: i18n.t('dataProvider.k1'),
      updatedAt: now,
    };
  }

  /**
 * update Regime（refreshmodule）
   *
 * ：
 * - GDP > 2% + CPI(1-3%) + VIX → bull
 * - GDP < 0% + VIX → bear
   * - VIX > 25 → volatile
 * - → sideways
   */
  saveMarketRegime(regime: MarketRegime): void {
    regime.updatedAt = Date.now();
    this.regimeCache = {
      data: regime,
      expires: Date.now() + DataProviderService.REGIME_TTL,
    };

    if (this.db) {
      this.db.prepare(`
        INSERT OR REPLACE INTO market_regime (id, state, confidence, factors_json, recommendation, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
      `).run(
        regime.state,
        regime.confidence,
        JSON.stringify(regime.factors),
        regime.recommendation,
        regime.updatedAt,
      );
    }

    log.info(`[DataProvider] Regime updated: ${regime.state} (${(regime.confidence * 100).toFixed(0)}%)`);
  }

  /**
 * factor Regime
   */
  computeRegime(factors: MarketRegime['factors']): MarketRegime {
    let score = 0; // -3 to +3

 // GDP 
    if (factors.gdpGrowth !== null) {
      if (factors.gdpGrowth > 2) score += 1;
      else if (factors.gdpGrowth < 0) score -= 1;
    }

 // CPI 
    if (factors.cpi !== null) {
      if (factors.cpi >= 1 && factors.cpi <= 3) score += 1;
      else if (factors.cpi > 5) score -= 1;
    }

 //
    if (factors.interestRate !== null) {
      if (factors.interestRate < 3) score += 1;
      else if (factors.interestRate > 5) score -= 1;
    }

    // VIX
    let state: MarketRegime['state'];
    let confidence: number;

    if (factors.vix !== null && factors.vix > 25) {
      state = 'volatile';
      confidence = Math.min(factors.vix / 40, 1);
    } else if (score >= 2) {
      state = 'bull';
      confidence = Math.min(score / 3, 1);
    } else if (score <= -2) {
      state = 'bear';
      confidence = Math.min(Math.abs(score) / 3, 1);
    } else {
      state = 'sideways';
      confidence = 0.5;
    }

    const recommendations: Record<string, string> = {
      bull: i18n.t('dataProvider.k2'),
      bear: i18n.t('dataProvider.k3'),
      sideways: i18n.t('dataProvider.k4'),
      volatile: i18n.t('dataProvider.k5'),
      unknown: i18n.t('dataProvider.k6'),
    };

    return {
      state,
      confidence,
      factors,
      recommendation: recommendations[state],
      updatedAt: Date.now(),
    };
  }

 // ── ──────────────────────────────────────────────────

  /**
 *
   */
  async getAnomalies(symbol: string): Promise<AnomalySignal[]> {
    const now = Date.now();

    const cached = this.anomalyCache.get(symbol);
    if (cached && cached.expires > now) return cached.data;

    if (this.db) {
      const rows = this.db.prepare(
        'SELECT * FROM anomaly_signals WHERE symbol = ? AND created_at > ? ORDER BY created_at DESC LIMIT 20'
      ).all(symbol, now - DataProviderService.ANOMALY_TTL) as any[];

      const signals: AnomalySignal[] = rows.map((r: unknown) => ({
        symbol: r.symbol,
        type: r.type,
        level: r.level,
        message: r.message,
        details: JSON.parse(r.details_json || '{}'),
        timestamp: r.created_at,
      }));

      this.anomalyCache.set(symbol, {
        data: signals,
        expires: now + DataProviderService.ANOMALY_TTL,
      });
      return signals;
    }

    return [];
  }

  /**
 *
   */
  saveAnomaly(signal: AnomalySignal): void {
    signal.timestamp = Date.now();

    // updatecache
    const existing = this.anomalyCache.get(signal.symbol);
    if (existing) {
      existing.data.unshift(signal);
      if (existing.data.length > 20) existing.data.pop();
    }

    if (this.db) {
      this.db.prepare(`
        INSERT INTO anomaly_signals (symbol, type, level, message, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        signal.symbol,
        signal.type,
        signal.level,
        signal.message,
        JSON.stringify(signal.details),
        signal.timestamp,
      );
    }

    log.info(`[DataProvider] Anomaly: ${signal.level} ${signal.type} ${signal.symbol} — ${signal.message}`);
  }

 // ── ──────────────────────────────────────────────────

  async getNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    const now = Date.now();

    const cached = this.newsCache.get(symbol);
    if (cached && cached.expires > now) return cached.data.slice(0, limit);

    if (this.db) {
      const rows = this.db.prepare(
        'SELECT * FROM news_cache WHERE symbol = ? AND fetched_at > ? ORDER BY publish_time DESC LIMIT ?'
      ).all(symbol, now - DataProviderService.NEWS_TTL, limit) as any[];

      const items: NewsItem[] = rows.map((r: unknown) => ({
        title: r.title,
        source: r.source,
        url: r.url,
        publishTime: r.publish_time,
        sentiment: r.sentiment,
        summary: r.summary,
      }));

      this.newsCache.set(symbol, {
        data: items,
        expires: now + DataProviderService.NEWS_TTL,
      });
      return items;
    }

    return [];
  }

  saveNews(symbol: string, items: NewsItem[]): void {
    const now = Date.now();
    this.newsCache.set(symbol, {
      data: items,
      expires: now + DataProviderService.NEWS_TTL,
    });

    if (this.db && items.length > 0) {
      const stmt = this.db.prepare(`
        INSERT INTO news_cache (symbol, title, source, url, publish_time, sentiment, summary, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = this.db.transaction((newsItems: NewsItem[]) => {
        for (const item of newsItems) {
          stmt.run(symbol, item.title, item.source, item.url, item.publishTime, item.sentiment, item.summary || '', now);
        }
      });
      tx(items);
    }
  }

 // ── （strategy/policy） ──────────────────────────────

  /**
 * （fundamental + + + regime）
 * back 0-100 
   */
  async getCompositeScore(symbol: string): Promise<{
    score: number;           // 0-100
    dimensions: {
      fundamental: number;   // fundamental 0-100
      capitalFlow: number;   // 资金面 0-100
      anomaly: number;       // 异动 0-100 (越高越危险)
      regime: string;        // current regime
    };
    signals: AnomalySignal[];
    updatedAt: number;
  }> {
    const [fundamental, capitalFlow, anomalies, regime] = await Promise.all([
      this.getFundamental(symbol),
      this.getCapitalFlow(symbol),
      this.getAnomalies(symbol),
      this.getMarketRegime(),
    ]);

 // fundamental（PE/PB/ROE/）
    let fundamentalScore = 50; // default中性
    if (fundamental) {
      if (fundamental.pe !== null && fundamental.pe > 0 && fundamental.pe < 20) fundamentalScore += 10;
      if (fundamental.roe !== null && fundamental.roe > 15) fundamentalScore += 15;
      if (fundamental.revenueGrowth !== null && fundamental.revenueGrowth > 10) fundamentalScore += 10;
      if (fundamental.profitGrowth !== null && fundamental.profitGrowth > 15) fundamentalScore += 10;
      if (fundamental.debtRatio !== null && fundamental.debtRatio > 70) fundamentalScore -= 15;
      fundamentalScore = Math.max(0, Math.min(100, fundamentalScore));
    }

 //
    let capitalScore = 50;
    if (capitalFlow && capitalFlow.mainNetInflow !== null) {
      if (capitalFlow.mainNetInflow > 0) capitalScore += 20;
      else capitalScore -= 10;
      capitalScore = Math.max(0, Math.min(100, capitalScore));
    }

 //
    let anomalyScore = 0;
    for (const a of anomalies) {
      if (a.level === 'critical') anomalyScore += 30;
      else if (a.level === 'warning') anomalyScore += 15;
      else anomalyScore += 5;
    }
    anomalyScore = Math.min(100, anomalyScore);

 //
    const composite = Math.round(
      fundamentalScore * 0.3 +
      capitalScore * 0.3 +
      (100 - anomalyScore) * 0.2 +
      (regime.state === 'bull' ? 80 : regime.state === 'bear' ? 20 : 50) * 0.2
    );

    return {
      score: Math.max(0, Math.min(100, composite)),
      dimensions: {
        fundamental: fundamentalScore,
        capitalFlow: capitalScore,
        anomaly: anomalyScore,
        regime: regime.state,
      },
      signals: anomalies,
      updatedAt: Date.now(),
    };
  }

 // ── cache ──────────────────────────────────────────────────

  clearExpiredCache(): void {
    const now = Date.now();

    for (const [key, val] of this.fundamentalCache) {
      if (val.expires < now) this.fundamentalCache.delete(key);
    }
    for (const [key, val] of this.capitalFlowCache) {
      if (val.expires < now) this.capitalFlowCache.delete(key);
    }
    if (this.regimeCache && this.regimeCache.expires < now) {
      this.regimeCache = null;
    }
    for (const [key, val] of this.anomalyCache) {
      if (val.expires < now) this.anomalyCache.delete(key);
    }
    for (const [key, val] of this.newsCache) {
      if (val.expires < now) this.newsCache.delete(key);
    }

 // SQLite expiry
    if (this.db) {
      this.db.prepare('DELETE FROM anomaly_signals WHERE created_at < ?').run(now - 7 * 24 * 60 * 60 * 1000);
      this.db.prepare('DELETE FROM news_cache WHERE fetched_at < ?').run(now - 7 * 24 * 60 * 60 * 1000);
    }

    log.info('[DataProvider] Cache cleanup done');
  }
}
