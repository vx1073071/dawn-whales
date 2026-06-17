/**
 * R276 auto#1: A股数据源→因子系统桥接 (AShareFactorBridge) v1.0
 * 
 * QUANT MOO — Bridges China A-share data sources into the unified
 * factor → signal → push pipeline.
 * 
 * 上游: eastmoney-fetcher.ts / china-data-sources.ts
 * 下游: factor-signal-pipeline.ts / push-ipc-bridge.ts
 * 
 * 10大A股特色信号类型:
 *   1. DDX(大单动向) → smart_money_flow
 *   2. DDY(大单差分) → order_imbalance
 *   3. DDZ(大单分时) → intraday_smart_money
 *   4. 北向资金     → northbound_flow
 *   5. 龙虎榜       → whale_trade
 *   6. 融资融券     → margin_status
 *   7. 板块资金     → sector_rotation
 *   8. 涨跌停分析   → market_width
 *   9. 市场宽度     → breadth_health
 *   10. 主力追踪    → main_force_tracking
 * 
 * 核心功能:
 *   1. ingest A-share data from existing sources
 *   2. detect signals (10 rules × configurable thresholds)
 *   3. score signals (0-100 confidence)
 *   4. bridge to factor-signal-pipeline
 *   5. factor registry mapping (CN_* factors → live data)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AShareSnapshot {
  symbol: string;
  name: string;
  exchange: 'SH' | 'SZ' | 'BJ';
  board: string;
  price: number;
  changePercent: number;
  volume: number;
  amount: number;
  turnover: number;
  pe: number;
  pb: number;
  marketCap: number;
  timestamp: number;
}

export interface AShareSmartMoney {
  symbol: string;
  name: string;
  ddx: number;                // 大单动向 (正=大单净买入)
  ddy: number;                // 大单差分 (正=大单买入力度)
  ddz: number;                // 大单分时 (正=大单持续买入)
  bigOrderNet: number;        // 大单净量(手)
  mainForceDirection: 'inflow' | 'outflow' | 'neutral';
  mainForceStrength: number;  // 0-100
  timestamp: number;
}

export interface AShareNorthbound {
  date: string;
  northboundNet: number;      // 北向净流入(亿)
  shanghaiNet: number;
  shenzhenNet: number;
  northboundStrength: number; // 0-100
  consecutiveDays: number;    // 连续净流入天数 (正=流入, 负=流出)
  topFlowStocks: Array<{ symbol: string; name: string; netFlow: number }>;
  timestamp: number;
}

export interface AShareDragonGate {
  symbol: string;
  name: string;
  reason: string;
  buyAmount: number;          // 买入(万)
  sellAmount: number;         // 卖出(万)
  netAmount: number;          // 净买入(万)
  institutionBuy: number;     // 机构买入
  institutionSell: number;    // 机构卖出
  whaleSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  impactScore: number;        // 0-100 上榜影响力
  timestamp: number;
}

export interface AShareMargin {
  date: string;
  shMarginBalance: number;    // 沪融资余额(亿)
  szMarginBalance: number;    // 深融资余额(亿)
  totalMarginBalance: number; // 总融资余额(亿)
  shShortBalance: number;     // 沪融券余额(亿)
  szShortBalance: number;     // 深融券余额(亿)
  marginRatio: number;        // 融资买入占比
  marginSignal: 'leverage_surge' | 'leverage_normal' | 'deleveraging';
  timestamp: number;
}

export interface AShareSectorFlow {
  sectorName: string;
  sectorNameCn: string;
  netFlow: number;            // 板块净流入(亿)
  mainNetFlow: number;        // 主力净流入(亿)
  topStock: string;
  changePercent: number;
  direction: 'strong_inflow' | 'inflow' | 'neutral' | 'outflow' | 'strong_outflow';
  sectorScore: number;        // 0-100
  timestamp: number;
}

export interface AShareLimitAnalysis {
  date: string;
  upLimitCount: number;       // 涨停家数
  downLimitCount: number;     // 跌停家数
  continuousUpLimit: number;  // 连板家数
  firstUpLimit: number;       // 首板家数
  blowBoard: number;          // 炸板家数
  limitRatio: number;         // 封板率%
  sentimentLevel: 'hot' | 'warm' | 'neutral' | 'cold' | 'freezing';
  breadthScore: number;       // 0-100
  timestamp: number;
}

/** Unified A-share factor signal */
export interface AShareFactorSignal {
  signalId: string;
  factorId: string;            // e.g. 'CN_DDX', 'CN_NORTHBOUND', 'CN_LIMIT_BREADTH'
  factorName: string;
  category: AShareSignalCategory;
  value: number;
  threshold: { low: number; high: number; critical: number };
  severity: 'info' | 'warning' | 'critical';
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;          // 0-100
  message: string;
  messageCn: string;
  reasoning: string;
  timestamp: number;
  expiresAt: number;
}

export type AShareSignalCategory =
  | 'smart_money'       // DDX/DDY/DDZ
  | 'northbound'        // 北向资金
  | 'whale_trade'       // 龙虎榜
  | 'margin_report'     // 融资融券
  | 'sector_rotation'   // 板块资金
  | 'limit_breadth'     // 涨跌停
  | 'market_health'     // 市场宽度
  | 'main_force'        // 主力追踪
  | 'turnover_alert'    // 换手率异常
  | 'cap_flow_divergence'; // 市值/资金背离

/** Bridge statistics */
export interface AShareBridgeStats {
  totalSnapshots: number;
  totalSignals: number;
  signalsByCategory: Record<AShareSignalCategory, number>;
  lastIngestAt: number;
  lastSignalAt: number;
  activeStocks: number;
}

/** Configuration */
export interface AShareBridgeConfig {
  /** DDX threshold for smart money signal */
  ddxThreshold: { inflow: number; outflow: number };
  /** Northbound consecutive days for signal */
  northboundStreakDays: number;
  /** Margin change % for leverage signal */
  marginChangeThreshold: number;
  /** Turnover % for alert */
  turnoverHighThreshold: number;
  /** Sentiment levels */
  hotLimitCount: number;
  coldLimitCount: number;
  /** Sector flow threshold (亿) */
  sectorFlowThreshold: number;
  /** Signal expiry (ms) */
  signalExpiryMs: number;
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_ASHARE_CONFIG: AShareBridgeConfig = {
  ddxThreshold: { inflow: 0.5, outflow: -0.5 },
  northboundStreakDays: 3,
  marginChangeThreshold: 5,         // 5%
  turnoverHighThreshold: 15,         // 15%
  hotLimitCount: 80,
  coldLimitCount: 20,
  sectorFlowThreshold: 10,
  signalExpiryMs: 24 * 60 * 60 * 1000, // 24h
};

// ── AShareFactorBridge ─────────────────────────────────────────────────────

export class AShareFactorBridge {
  private config: AShareBridgeConfig;
  
  // Data caches
  private snapshots: Map<string, AShareSnapshot> = new Map();
  private smartMoney: Map<string, AShareSmartMoney> = new Map();
  private northboundHistory: AShareNorthbound[] = [];
  private dragonGates: Map<string, AShareDragonGate[]> = new Map();
  private latestMargin: AShareMargin | null = null;
  private sectorFlows: Map<string, AShareSectorFlow> = new Map();
  private limitAnalysis: AShareLimitAnalysis | null = null;
  
  // Signals
  private signals: AShareFactorSignal[] = [];
  private signalHistory: AShareFactorSignal[] = [];
  
  // Stats
  private stats: AShareBridgeStats = {
    totalSnapshots: 0,
    totalSignals: 0,
    signalsByCategory: {} as Record<AShareSignalCategory, number>,
    lastIngestAt: 0,
    lastSignalAt: 0,
    activeStocks: 0,
  };
  
  // Callbacks
  private signalHandlers: Array<(signal: AShareFactorSignal) => void> = [];
  
  constructor(config?: Partial<AShareBridgeConfig>) {
    this.config = { ...DEFAULT_ASHARE_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Data Ingestion
  // ═══════════════════════════════════════════════════════════════════════

  /** Ingest a snapshot (from eastmoney-fetcher quote) */
  ingestSnapshot(snapshot: AShareSnapshot): void {
    this.snapshots.set(snapshot.symbol, snapshot);
    this.stats.totalSnapshots++;
    this.stats.lastIngestAt = Date.now();
    this.stats.activeStocks = this.snapshots.size;
  }

  /** Batch ingest snapshots */
  ingestSnapshots(snapshots: AShareSnapshot[]): void {
    for (const s of snapshots) {
      this.snapshots.set(s.symbol, s);
    }
    this.stats.totalSnapshots += snapshots.length;
    this.stats.lastIngestAt = Date.now();
    this.stats.activeStocks = this.snapshots.size;
  }

  /** Ingest smart money data (DDX/DDY/DDZ) */
  ingestSmartMoney(data: AShareSmartMoney): void {
    this.smartMoney.set(data.symbol, data);
    this.stats.lastIngestAt = Date.now();
    
    // Detect smart money signals
    this._detectSmartMoneySignals(data);
  }

  /** Ingest northbound flow */
  ingestNorthbound(data: AShareNorthbound): void {
    this.northboundHistory.push(data);
    // Keep last 30 days
    if (this.northboundHistory.length > 30) {
      this.northboundHistory = this.northboundHistory.slice(-30);
    }
    this.stats.lastIngestAt = Date.now();
    
    this._detectNorthboundSignals(data);
  }

  /** Ingest dragon gate record */
  ingestDragonGate(record: AShareDragonGate): void {
    const existing = this.dragonGates.get(record.symbol) ?? [];
    existing.push(record);
    if (existing.length > 100) existing.shift();
    this.dragonGates.set(record.symbol, existing);
    this.stats.lastIngestAt = Date.now();
    
    this._detectWhaleSignals(record);
  }

  /** Ingest margin data */
  ingestMargin(data: AShareMargin): void {
    this.latestMargin = data;
    this.stats.lastIngestAt = Date.now();
    
    this._detectMarginSignals(data);
  }

  /** Ingest sector flow */
  ingestSectorFlow(data: AShareSectorFlow): void {
    this.sectorFlows.set(data.sectorName, data);
    this.stats.lastIngestAt = Date.now();
    
    this._detectSectorRotationSignals(data);
  }

  /** Ingest limit analysis */
  ingestLimitAnalysis(data: AShareLimitAnalysis): void {
    this.limitAnalysis = data;
    this.stats.lastIngestAt = Date.now();
    
    this._detectLimitBreadthSignals(data);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Query
  // ═══════════════════════════════════════════════════════════════════════

  /** Get latest signals, optionally filtered by category */
  getSignals(category?: AShareSignalCategory): AShareFactorSignal[] {
    if (!category) return [...this.signals];
    return this.signals.filter(s => s.category === category);
  }

  /** Get signals for a specific stock */
  getSignalsForStock(symbol: string): AShareFactorSignal[] {
    return this.signals.filter(s => {
      // Signals contain symbol in factorId or reasoning
      return s.factorId.includes(symbol) || s.reasoning.includes(symbol);
    });
  }

  /** Get current northbound status */
  getNorthboundStatus(): AShareNorthbound | null {
    return this.northboundHistory.length > 0
      ? this.northboundHistory[this.northboundHistory.length - 1]
      : null;
  }

  /** Get latest margin status */
  getMarginStatus(): AShareMargin | null {
    return this.latestMargin;
  }

  /** Get limit analysis */
  getLimitAnalysis(): AShareLimitAnalysis | null {
    return this.limitAnalysis;
  }

  /** Get top sector flows */
  getTopSectorFlows(limit = 10): AShareSectorFlow[] {
    return Array.from(this.sectorFlows.values())
      .sort((a, b) => b.netFlow - a.netFlow)
      .slice(0, limit);
  }

  /** Get snapshot for a symbol */
  getSnapshot(symbol: string): AShareSnapshot | null {
    return this.snapshots.get(symbol) ?? null;
  }

  /** Get smart money data for a symbol */
  getSmartMoney(symbol: string): AShareSmartMoney | null {
    return this.smartMoney.get(symbol) ?? null;
  }

  /** Get dragon gate history for a symbol */
  getDragonGateHistory(symbol: string): AShareDragonGate[] {
    return this.dragonGates.get(symbol) ?? [];
  }

  /** Get bridge statistics */
  getStats(): AShareBridgeStats {
    return { ...this.stats, signalsByCategory: { ...this.stats.signalsByCategory } };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Cross-indicator Composite Scoring
  // ═══════════════════════════════════════════════════════════════════════

  /** Compute A-share composite sentiment score (-100 ~ +100) */
  computeCompositeSentiment(): number {
    let score = 0;
    let weightSum = 0;

    // 1. Northbound flow (weight: 25)
    const nb = this.getNorthboundStatus();
    if (nb) {
      const nbScore = Math.min(100, Math.max(-100, nb.northboundNet * 2));
      score += nbScore * 0.25;
      weightSum += 0.25;
    }

    // 2. Smart money DDX aggregate (weight: 20)
    const smList = Array.from(this.smartMoney.values());
    if (smList.length > 0) {
      const avgDdx = smList.reduce((s, d) => s + d.ddx, 0) / smList.length;
      const ddxScore = Math.min(100, Math.max(-100, avgDdx * 50));
      score += ddxScore * 0.20;
      weightSum += 0.20;
    }

    // 3. Limit breadth (weight: 20)
    if (this.limitAnalysis) {
      const limitScore = Math.min(100, Math.max(-100,
        (this.limitAnalysis.upLimitCount - this.limitAnalysis.downLimitCount) * 0.5
      ));
      score += limitScore * 0.20;
      weightSum += 0.20;
    }

    // 4. Margin trend (weight: 15)
    if (this.latestMargin) {
      const marginScore = this.latestMargin.marginSignal === 'leverage_surge' ? 60
        : this.latestMargin.marginSignal === 'deleveraging' ? -60 : 0;
      score += marginScore * 0.15;
      weightSum += 0.15;
    }

    // 5. Sector flow breadth (weight: 20)
    const sectorFlows = Array.from(this.sectorFlows.values());
    if (sectorFlows.length > 0) {
      const inflowCount = sectorFlows.filter(s => s.netFlow > 0).length;
      const sectorScore = (inflowCount / sectorFlows.length - 0.5) * 200;
      score += sectorScore * 0.20;
      weightSum += 0.20;
    }

    return weightSum > 0 ? Math.round(score / weightSum) : 0;
  }

  /** Compute a per-stock composite score (0-100) */
  computeStockScore(symbol: string): number {
    let score = 50; // neutral baseline
    let contributions = 0;

    const sm = this.smartMoney.get(symbol);
    if (sm) {
      score += sm.bigOrderNet > 0 ? 15 : sm.bigOrderNet < 0 ? -15 : 0;
      score += sm.ddx > 0.5 ? 10 : sm.ddx < -0.5 ? -10 : 0;
      contributions++;
    }

    const dgEntries = this.dragonGates.get(symbol);
    if (dgEntries && dgEntries.length > 0) {
      const latest = dgEntries[dgEntries.length - 1];
      if (latest.netAmount > 5000) score += 15;
      else if (latest.netAmount > 1000) score += 8;
      else if (latest.netAmount < -5000) score -= 15;
      contributions++;
    }

    const snap = this.snapshots.get(symbol);
    if (snap) {
      if (snap.turnover > 20) score += 10;
      else if (snap.turnover < 3) score -= 5;
      if (snap.changePercent > 5) score += 8;
      else if (snap.changePercent < -5) score -= 8;
      contributions++;
    }

    return contributions > 0 ? Math.max(0, Math.min(100, score)) : 50;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Signal Streaming
  // ═══════════════════════════════════════════════════════════════════════

  /** Subscribe to new signals */
  onSignal(handler: (signal: AShareFactorSignal) => void): () => void {
    this.signalHandlers.push(handler);
    return () => {
      const idx = this.signalHandlers.indexOf(handler);
      if (idx >= 0) this.signalHandlers.splice(idx, 1);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Config
  // ═══════════════════════════════════════════════════════════════════════

  updateConfig(patch: Partial<AShareBridgeConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): AShareBridgeConfig {
    return { ...this.config };
  }

  /** Clear all caches */
  reset(): void {
    this.snapshots.clear();
    this.smartMoney.clear();
    this.northboundHistory = [];
    this.dragonGates.clear();
    this.latestMargin = null;
    this.sectorFlows.clear();
    this.limitAnalysis = null;
    this.signals = [];
    this.signalHistory = [];
    this.stats = {
      totalSnapshots: 0,
      totalSignals: 0,
      signalsByCategory: {} as Record<AShareSignalCategory, number>,
      lastIngestAt: 0,
      lastSignalAt: 0,
      activeStocks: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Signal Detection
  // ═══════════════════════════════════════════════════════════════════════

  private _emitSignal(signal: AShareFactorSignal): void {
    this.signals.unshift(signal);
    // Keep last 500 signals
    if (this.signals.length > 500) this.signals = this.signals.slice(0, 500);
    this.signalHistory.push(signal);
    this.stats.totalSignals++;
    this.stats.lastSignalAt = Date.now();
    
    this.stats.signalsByCategory[signal.category] =
      (this.stats.signalsByCategory[signal.category] ?? 0) + 1;

    // Notify handlers
    for (const handler of this.signalHandlers) {
      try { handler(signal); } catch { /* handler error non-fatal */ }
    }
  }

  private _makeSignal(
    factorId: string,
    factorName: string,
    category: AShareSignalCategory,
    value: number,
    threshold: { low: number; high: number; critical: number },
    severity: 'info' | 'warning' | 'critical',
    direction: 'bullish' | 'bearish' | 'neutral',
    confidence: number,
    message: string,
    messageCn: string,
    reasoning: string,
  ): AShareFactorSignal {
    return {
      signalId: `cn_${factorId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      factorId,
      factorName,
      category,
      value,
      threshold,
      severity,
      direction,
      confidence,
      message,
      messageCn,
      reasoning,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.signalExpiryMs,
    };
  }

  /** DDX/DDY/DDZ → Smart Money signals */
  private _detectSmartMoneySignals(data: AShareSmartMoney): void {
    const { ddxThreshold } = this.config;

    // Strong DDX signal
    if (data.ddx > ddxThreshold.inflow) {
      this._emitSignal(this._makeSignal(
        'CN_DDX', '大单动向(DDX)', 'smart_money', data.ddx,
        { low: -0.2, high: ddxThreshold.inflow, critical: 1.0 },
        data.ddx > 1.0 ? 'critical' : 'warning',
        'bullish', 70 + Math.min(30, Math.abs(data.ddx) * 20),
        `DDX surged to ${data.ddx.toFixed(2)} for ${data.name}: large orders aggressively buying`,
        `${data.name} DDX飙升至${data.ddx.toFixed(2)}，大单密集买入`,
        `DDX=${data.ddx.toFixed(2)}, 主力方向=流入, 力度=${data.mainForceStrength}`,
      ));
    } else if (data.ddx < ddxThreshold.outflow) {
      this._emitSignal(this._makeSignal(
        'CN_DDX', '大单动向(DDX)', 'smart_money', data.ddx,
        { low: ddxThreshold.outflow, high: 0.2, critical: -1.0 },
        data.ddx < -1.0 ? 'critical' : 'warning',
        'bearish', 70 + Math.min(30, Math.abs(data.ddx) * 20),
        `DDX dropped to ${data.ddx.toFixed(2)} for ${data.name}: large orders selling`,
        `${data.name} DDX跌至${data.ddx.toFixed(2)}，大单密集卖出`,
        `DDX=${data.ddx.toFixed(2)}, 主力方向=流出, 力度=${data.mainForceStrength}`,
      ));
    }

    // DDY signal — order imbalance
    if (Math.abs(data.ddy) > 0.3) {
      const dir = data.ddy > 0 ? 'bullish' : 'bearish';
      this._emitSignal(this._makeSignal(
        'CN_DDY', '大单差分(DDY)', 'smart_money', data.ddy,
        { low: -0.2, high: 0.2, critical: 0.5 },
        Math.abs(data.ddy) > 0.5 ? 'critical' : 'warning',
        dir, 65 + Math.min(35, Math.abs(data.ddy) * 50),
        `DDY at ${data.ddy.toFixed(2)} for ${data.name}: ${dir === 'bullish' ? 'buy orders dominate' : 'sell orders dominate'}`,
        `${data.name} DDY=${data.ddy.toFixed(2)}，${dir === 'bullish' ? '买单主导' : '卖单主导'}`,
        `大单净量=${data.bigOrderNet}, DDY${data.ddy.toFixed(2)}`,
      ));
    }

    // Turnover alert
    const snap = this.snapshots.get(data.symbol);
    if (snap && snap.turnover > this.config.turnoverHighThreshold) {
      this._emitSignal(this._makeSignal(
        'CN_TURNOVER', '换手率异常', 'turnover_alert', snap.turnover,
        { low: 5, high: this.config.turnoverHighThreshold, critical: 25 },
        snap.turnover > 25 ? 'critical' : 'warning',
        'neutral', 60 + Math.min(40, snap.turnover),
        `${snap.name} turnover surged to ${snap.turnover}% — unusual activity detected`,
        `${snap.name} 换手率达${snap.turnover}%，交易异常活跃`,
        `换手率=${snap.turnover}%, DDX=${data.ddx.toFixed(2)}`,
      ));
    }
  }

  /** Northbound flow signals */
  private _detectNorthboundSignals(data: AShareNorthbound): void {
    // Streak signal
    if (Math.abs(data.consecutiveDays) >= this.config.northboundStreakDays) {
      const dir = data.consecutiveDays > 0 ? 'bullish' : 'bearish';
      const sev = Math.abs(data.consecutiveDays) >= 7 ? 'critical' : 'warning';
      this._emitSignal(this._makeSignal(
        'CN_NORTHBOUND', '北向资金', 'northbound', data.northboundNet,
        { low: -50, high: 50, critical: 100 },
        sev, dir, 65 + Math.min(35, Math.abs(data.consecutiveDays) * 5),
        `Northbound flow ${dir === 'bullish' ? 'net inflow' : 'net outflow'} for ${Math.abs(data.consecutiveDays)} consecutive days: ${data.northboundNet.toFixed(1)}亿`,
        `北向资金连续${Math.abs(data.consecutiveDays)}天净${dir === 'bullish' ? '流入' : '流出'}，累计${data.northboundNet.toFixed(1)}亿`,
        `连续${data.consecutiveDays}天, 沪${data.shanghaiNet.toFixed(1)}+深${data.shenzhenNet.toFixed(1)}亿`,
      ));
    }

    // Large single-day flow
    if (Math.abs(data.northboundNet) > 100) {
      const dir2 = data.northboundNet > 0 ? 'bullish' : 'bearish';
      this._emitSignal(this._makeSignal(
        'CN_NORTHBOUND_SPIKE', '北向资金突增', 'northbound', data.northboundNet,
        { low: -50, high: 50, critical: 100 },
        Math.abs(data.northboundNet) > 200 ? 'critical' : 'warning',
        dir2, 75 + Math.min(25, Math.abs(data.northboundNet) / 10),
        `Massive northbound ${dir2 === 'bullish' ? 'inflow' : 'outflow'}: ${data.northboundNet.toFixed(1)}亿 today`,
        `北向资金今日大额净${dir2 === 'bullish' ? '流入' : '流出'}${data.northboundNet.toFixed(1)}亿`,
        `沪${data.shanghaiNet.toFixed(1)}+深${data.shenzhenNet.toFixed(1)}亿, 外资异动`,
      ));
    }
  }

  /** Dragon gate → Whale signals */
  private _detectWhaleSignals(record: AShareDragonGate): void {
    if (record.institutionBuy > 10_000) {
      this._emitSignal(this._makeSignal(
        'CN_DRAGON_GATE', '龙虎榜机构买入', 'whale_trade', record.institutionBuy,
        { low: 1000, high: 5000, critical: 10000 },
        record.institutionBuy > 20_000 ? 'critical' : 'warning',
        'bullish', 75 + Math.min(25, record.institutionBuy / 2000),
        `Dragon Gate: ${record.name} institutional buy ${(record.institutionBuy/10000).toFixed(2)}亿 — whale accumulation`,
        `龙虎榜: ${record.name} 机构买入${(record.institutionBuy/10000).toFixed(2)}亿，主力建仓迹象`,
        `上榜原因:${record.reason}, 机构买${record.institutionBuy}卖${record.institutionSell}`,
      ));
    }

    if (record.netAmount < -10_000) {
      this._emitSignal(this._makeSignal(
        'CN_DRAGON_GATE_SELL', '龙虎榜机构卖出', 'whale_trade', record.netAmount,
        { low: -5000, high: -1000, critical: -10000 },
        record.netAmount < -20_000 ? 'critical' : 'warning',
        'bearish', 75 + Math.min(25, Math.abs(record.netAmount) / 2000),
        `Dragon Gate: ${record.name} net sell ${Math.abs(record.netAmount/10000).toFixed(2)}亿 — whale distributing`,
        `龙虎榜: ${record.name} 净卖出${Math.abs(record.netAmount/10000).toFixed(2)}亿，主力出货迹象`,
        `上榜原因:${record.reason}, 机构买${record.institutionBuy}卖${record.institutionSell}`,
      ));
    }
  }

  /** Margin signals */
  private _detectMarginSignals(data: AShareMargin): void {
    if (data.marginSignal === 'leverage_surge') {
      this._emitSignal(this._makeSignal(
        'CN_MARGIN', '融资余额飙升', 'margin_report', data.totalMarginBalance,
        { low: 8000, high: 12000, critical: 15000 },
        data.totalMarginBalance > 15000 ? 'critical' : 'warning',
        'bullish', 60,
        `Margin balance surged to ${data.totalMarginBalance}亿 — leverage increasing`,
        `融资余额攀升至${data.totalMarginBalance}亿，杠杆资金入场`,
        `沪${data.shMarginBalance}+深${data.szMarginBalance}亿, 融券${data.shShortBalance+data.szShortBalance}亿`,
      ));
    } else if (data.marginSignal === 'deleveraging') {
      this._emitSignal(this._makeSignal(
        'CN_MARGIN_DEL', '融资余额下降', 'margin_report', data.totalMarginBalance,
        { low: 6000, high: 10000, critical: 5000 },
        'warning',
        'bearish', 55,
        `Margin balance declining — de-leveraging in progress`,
        `融资余额下降中，市场去杠杆`,
        `融资余额${data.totalMarginBalance}亿, 融資佔比${data.marginRatio}%`,
      ));
    }
  }

  /** Sector rotation signals */
  private _detectSectorRotationSignals(data: AShareSectorFlow): void {
    if (['strong_inflow', 'inflow'].includes(data.direction) && data.netFlow > this.config.sectorFlowThreshold) {
      this._emitSignal(this._makeSignal(
        'CN_SECTOR_FLOW', '板块资金流入', 'sector_rotation', data.netFlow,
        { low: this.config.sectorFlowThreshold, high: 50, critical: 100 },
        data.netFlow > 50 ? 'critical' : 'warning',
        'bullish', 60 + Math.min(40, data.netFlow),
        `Sector "${data.sectorNameCn}" net inflow ${data.netFlow.toFixed(1)}亿 — capital rotating in`,
        `板块"${data.sectorNameCn}"净流入${data.netFlow.toFixed(1)}亿，资金轮动入场`,
        `主力净流入${data.mainNetFlow.toFixed(1)}亿, 领涨股:${data.topStock}`,
      ));
    } else if (['strong_outflow', 'outflow'].includes(data.direction) && Math.abs(data.netFlow) > this.config.sectorFlowThreshold) {
      this._emitSignal(this._makeSignal(
        'CN_SECTOR_OUTFLOW', '板块资金流出', 'sector_rotation', data.netFlow,
        { low: -50, high: -this.config.sectorFlowThreshold, critical: -100 },
        Math.abs(data.netFlow) > 50 ? 'critical' : 'warning',
        'bearish', 60 + Math.min(40, Math.abs(data.netFlow)),
        `Sector "${data.sectorNameCn}" net outflow ${Math.abs(data.netFlow).toFixed(1)}亿 — capital rotating out`,
        `板块"${data.sectorNameCn}"净流出${Math.abs(data.netFlow).toFixed(1)}亿，资金轮动撤离`,
        `主力净流入${data.mainNetFlow.toFixed(1)}亿`,
      ));
    }
  }

  /** Limit breadth signals */
  private _detectLimitBreadthSignals(data: AShareLimitAnalysis): void {
    if (data.sentimentLevel === 'hot') {
      this._emitSignal(this._makeSignal(
        'CN_LIMIT_HOT', '涨停潮', 'limit_breadth', data.upLimitCount,
        { low: 30, high: this.config.hotLimitCount, critical: 120 },
        data.upLimitCount > 120 ? 'critical' : 'warning',
        'bullish', 70 + Math.min(30, data.upLimitCount / 5),
        `${data.upLimitCount} stocks hit limit-up today — market sentiment overheated. 封板率${(data.limitRatio*100).toFixed(0)}%`,
        `今日涨停${data.upLimitCount}家，市场情绪高涨。封板率${(data.limitRatio*100).toFixed(0)}%，连板${data.continuousUpLimit}家`,
        `涨停${data.upLimitCount}/跌停${data.downLimitCount}, 首板${data.firstUpLimit}, 炸板${data.blowBoard}`,
      ));
    } else if (data.sentimentLevel === 'freezing') {
      this._emitSignal(this._makeSignal(
        'CN_LIMIT_COLD', '跌停潮', 'limit_breadth', data.downLimitCount,
        { low: 10, high: 30, critical: 50 },
        data.downLimitCount > 50 ? 'critical' : 'warning',
        'bearish', 70 + Math.min(30, data.downLimitCount / 2),
        `${data.downLimitCount} stocks hit limit-down today — market fear extreme`,
        `今日跌停${data.downLimitCount}家，市场恐慌情绪极端`,
        `涨停${data.upLimitCount}/跌停${data.downLimitCount}, 市场情绪:冻结`,
      ));
    }

    // Blow board rate signal
    if (data.blowBoard > 10 && data.limitRatio < 0.5) {
      this._emitSignal(this._makeSignal(
        'CN_BLOW_BOARD', '炸板率高', 'limit_breadth', data.blowBoard,
        { low: 3, high: 10, critical: 20 },
        'warning',
        'bearish', 60,
        `${data.blowBoard} stocks blew up at limit today (封板率仅${(data.limitRatio*100).toFixed(0)}%) — weak follow-through`,
        `今日${data.blowBoard}家炸板，封板率仅${(data.limitRatio*100).toFixed(0)}%，追涨情绪弱`,
        `涨停${data.upLimitCount}/跌停${data.downLimitCount}, 炸板${data.blowBoard}`,
      ));
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _ashareBridge: AShareFactorBridge | null = null;

export function getAShareBridge(): AShareFactorBridge {
  if (!_ashareBridge) _ashareBridge = new AShareFactorBridge();
  return _ashareBridge;
}

export function resetAShareBridge(): void {
  if (_ashareBridge) _ashareBridge.reset();
  _ashareBridge = null;
}
