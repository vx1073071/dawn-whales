/**
 * R274 🇭🇰🇨🇳 市场指标桥接 v5.0
 * 
 * Bridges Hong Kong & China market data sources into the unified
 * indicator → signal → push pipeline:
 *   🇭🇰 HK: ShortSell → Signal, StockConnect → Flow indicator,
 *         Hang Seng derivatives → IV/vanna/charm indicators
 *   🇨🇳 CN: DDX/ZJLX/DDE/资金流向 → Smart money indicators,
 *         龙虎榜 → Whale signal, 北向 → Northbound flow,
 *         涨跌停 → Market width, 板块资金 → Sector rotation
 * 
 * IPC channels:
 *   hk:indicator:signal  — HK indicators → push signals
 *   cn:indicator:signal  — CN indicators → push signals
 *   hkcn:cross:compare   — Cross-market comparison
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface HkIndicatorSignal {
  signalId: string;
  category: 'shortsell' | 'stock_connect' | 'derivative' | 'market_breadth';
  indicator: string;
  value: number;
  threshold: { low: number; high: number; critical: number };
  severity: 'info' | 'warning' | 'critical';
  direction: 'bullish' | 'bearish' | 'neutral';
  message: string;
  messageCn: string;
  timestamp: number;
}

export interface CnIndicatorSignal {
  signalId: string;
  category: 'smart_money' | 'northbound' | 'market_width' | 'sector_flow' | 'whale';
  indicator: string;
  value: number;
  threshold: { low: number; high: number; critical: number };
  severity: 'info' | 'warning' | 'critical';
  direction: 'bullish' | 'bearish' | 'neutral';
  message: string;
  messageCn: string;
  timestamp: number;
}

export interface HkCnCrossComparison {
  timestamp: number;
  hk: {
    shortsellRatio: number;
    stockConnectNet: number;
    marketBreadth: number;     // advancing / declining ratio
    sentimentScore: number;   // -100 ~ +100
  };
  cn: {
    northboundNet: number;
    ddxScore: number;
    limitUpRatio: number;     // 涨停家数 / total
    sentimenScore: number;
  };
  signals: {
    divergence: boolean;       // HK vs CN sentiment diverge
    correlation: number;       // HK-CN flow correlation
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    summary: string;
    summaryCn: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HK Indicator Thresholds
// ═══════════════════════════════════════════════════════════════════════════

const HK_THRESHOLDS = {
  shortsell_ratio:  { low: 10,  high: 20,  critical: 40 },
  stock_connect_net: { low: -500, high: 500, critical: null as number | null },
  hsi_iv:           { low: 15,  high: 25,  critical: 35 },
  adr_ratio:        { low: 0.3, high: 0.7, critical: null },
  hsi_pe:           { low: 8,   high: 14,  critical: 20 },
  turnover_change:  { low: -30, high: 30,  critical: 60 },
};

const CN_THRESHOLDS = {
  northbound_net:   { low: -50,  high: 50,  critical: null as number | null },
  ddx_score:        { low: -0.5, high: 0.5,  critical: 1.0 },
  limit_up_ratio:   { low: 2,    high: 5,    critical: 10 },
  limit_down_ratio: { low: 1,    high: 3,    critical: 8 },
  margin_balance:   { low: 800,  high: 1200, critical: 1500 },
  sector_concentration: { low: 30, high: 50, critical: 70 },
};

// ═══════════════════════════════════════════════════════════════════════════
// HkCnIndicatorBridge
// ═══════════════════════════════════════════════════════════════════════════

export class HkCnIndicatorBridge {
  private hkSignals_: HkIndicatorSignal[] = [];
  private cnSignals_: CnIndicatorSignal[] = [];
  private lastComparison_: HkCnCrossComparison | null = null;

  // ── HK: Short Sell Indicator ──────────────────────────────────────────

  /** Evaluate HK short sell ratio */
  evaluateShortsell(totalTurnover: number, shortsellTurnover: number): HkIndicatorSignal | null {
    const ratio = totalTurnover > 0 ? (shortsellTurnover / totalTurnover) * 100 : 0;
    const t = HK_THRESHOLDS.shortsell_ratio;

    let severity: HkIndicatorSignal['severity'] = 'info';
    let direction: HkIndicatorSignal['direction'] = 'neutral';
    let message = '';
    let messageCn = '';

    if (ratio >= t.critical) {
      severity = 'critical'; direction = 'bearish';
      message = `HK shortsell ratio ${ratio.toFixed(1)}% (CRITICAL: extreme bearish pressure)`;
      messageCn = `港股卖空比率 ${ratio.toFixed(1)}% (严重: 极端沽压)`;
    } else if (ratio >= t.high) {
      severity = 'warning'; direction = 'bearish';
      message = `HK shortsell ratio ${ratio.toFixed(1)}% (WARNING: elevated shorts)`;
      messageCn = `港股卖空比率 ${ratio.toFixed(1)}% (预警: 偏高沽压)`;
    } else if (ratio <= t.low) {
      severity = 'info'; direction = 'bullish';
      message = `HK shortsell ratio ${ratio.toFixed(1)}% (LOW: healthy)`;
      messageCn = `港股卖空比率 ${ratio.toFixed(1)}% (低: 正常)`;
    }

    if (!message) return null;

    const signal: HkIndicatorSignal = {
      signalId: `hk_short_${Date.now()}`,
      category: 'shortsell',
      indicator: 'shortsell_ratio',
      value: ratio,
      threshold: t,
      severity, direction, message, messageCn,
      timestamp: Date.now(),
    };
    this.hkSignals_.push(signal);
    return signal;
  }

  /** Evaluate HK stock connect net flow */
  evaluateStockConnect(northboundNet: number, southboundNet: number): HkIndicatorSignal {
    const combined = northboundNet + southboundNet; // simple combined view
    const t = HK_THRESHOLDS.stock_connect_net;

    let severity: HkIndicatorSignal['severity'] = 'info';
    let direction: HkIndicatorSignal['direction'] = 'neutral';

    if (combined > (t.high * 2)) { severity = 'critical'; direction = 'bullish'; }
    else if (combined > t.high) { severity = 'info'; direction = 'bullish'; }
    else if (combined < (t.low * 2)) { severity = 'critical'; direction = 'bearish'; }
    else if (combined < t.low) { severity = 'warning'; direction = 'bearish'; }

    const signal: HkIndicatorSignal = {
      signalId: `hk_sc_${Date.now()}`,
      category: 'stock_connect',
      indicator: 'stock_connect_net',
      value: combined,
      threshold: t,
      severity, direction,
      message: `Stock Connect net flow: ${combined > 0 ? '+' : ''}${combined} (N:${northboundNet} S:${southboundNet})`,
      messageCn: `港股通净流入: ${combined > 0 ? '+' : ''}${combined} (北向:${northboundNet} 南向:${southboundNet})`,
      timestamp: Date.now(),
    };
    this.hkSignals_.push(signal);
    return signal;
  }

  /** Evaluate HK market breadth (advancing/declining ratio) */
  evaluateHkBreadth(advancing: number, declining: number, unchanged: number): HkIndicatorSignal {
    const total = advancing + declining + unchanged;
    const ratio = declining > 0 ? advancing / declining : 99;
    const t = HK_THRESHOLDS.adr_ratio;

    let severity: HkIndicatorSignal['severity'] = 'info';
    let direction: HkIndicatorSignal['direction'] = 'neutral';

    if (ratio >= 3) { severity = 'critical'; direction = 'bullish'; }
    else if (ratio >= (t.high ?? 0.7)) { direction = 'bullish'; }
    else if (ratio <= (t.low ?? 0.3)) { severity = 'warning'; direction = 'bearish'; }

    const signal: HkIndicatorSignal = {
      signalId: `hk_breadth_${Date.now()}`,
      category: 'market_breadth',
      indicator: 'adr_ratio',
      value: ratio,
      threshold: t,
      severity, direction,
      message: `HK ADR: ${ratio.toFixed(2)} (A:${advancing} D:${declining} U:${unchanged})`,
      messageCn: `港股涨跌比: ${ratio.toFixed(2)} (涨:${advancing} 跌:${declining} 平:${unchanged})`,
      timestamp: Date.now(),
    };
    this.hkSignals_.push(signal);
    return signal;
  }

  // ── CN: China Indicator Evaluation ──

  /** Evaluate northbound flow */
  evaluateNorthbound(netInflow: number): CnIndicatorSignal {
    const t = CN_THRESHOLDS.northbound_net;

    let severity: CnIndicatorSignal['severity'] = 'info';
    let direction: CnIndicatorSignal['direction'] = 'neutral';

    if (netInflow > (t.high * 3)) { severity = 'critical'; direction = 'bullish'; }
    else if (netInflow > t.high) { severity = 'info'; direction = 'bullish'; }
    else if (netInflow < (t.low * 3)) { severity = 'critical'; direction = 'bearish'; }
    else if (netInflow < t.low) { severity = 'warning'; direction = 'bearish'; }

    const signal: CnIndicatorSignal = {
      signalId: `cn_nb_${Date.now()}`,
      category: 'northbound',
      indicator: 'northbound_net',
      value: netInflow,
      threshold: t,
      severity, direction,
      message: `Northbound net flow: ${netInflow > 0 ? '+' : ''}${netInflow} 亿`,
      messageCn: `北向资金净流入: ${netInflow > 0 ? '+' : ''}${netInflow}亿`,
      timestamp: Date.now(),
    };
    this.cnSignals_.push(signal);
    return signal;
  }

  /** Evaluate DDX smart money score */
  evaluateDdx(ddx: number): CnIndicatorSignal {
    const t = CN_THRESHOLDS.ddx_score;

    let severity: CnIndicatorSignal['severity'] = 'info';
    let direction: CnIndicatorSignal['direction'] = 'neutral';

    if (ddx >= t.critical) { severity = 'critical'; direction = 'bullish'; }
    else if (ddx >= t.high) { severity = 'warning'; direction = 'bullish'; }
    else if (ddx <= -t.critical) { severity = 'critical'; direction = 'bearish'; }
    else if (ddx <= -t.high) { severity = 'warning'; direction = 'bearish'; }

    const signal: CnIndicatorSignal = {
      signalId: `cn_ddx_${Date.now()}`,
      category: 'smart_money',
      indicator: 'ddx_score',
      value: ddx,
      threshold: t,
      severity, direction,
      message: `DDX: ${ddx.toFixed(3)} (${ddx > 0 ? 'smart money buying' : 'smart money selling'})`,
      messageCn: `DDX: ${ddx.toFixed(3)} (${ddx > 0 ? '主力买入' : '主力卖出'})`,
      timestamp: Date.now(),
    };
    this.cnSignals_.push(signal);
    return signal;
  }

  /** Evaluate market width via limit up/down ratio */
  evaluateMarketWidth(limitUp: number, limitDown: number, totalStocks: number): CnIndicatorSignal {
    const upRatio = totalStocks > 0 ? (limitUp / totalStocks) * 100 : 0;
    const downRatio = totalStocks > 0 ? (limitDown / totalStocks) * 100 : 0;
    
    let severity: CnIndicatorSignal['severity'] = 'info';
    let direction: CnIndicatorSignal['direction'] = 'neutral';
    let message = '';
    let messageCn = '';

    if (downRatio >= CN_THRESHOLDS.limit_down_ratio.critical) {
      severity = 'critical'; direction = 'bearish';
      message = `Limit-down flood: ${downRatio.toFixed(1)}% stocks limit-down, ${limitDown} stocks`;
      messageCn = `跌停潮: ${downRatio.toFixed(1)}%股票跌停, ${limitDown}只跌停`;
    } else if (downRatio >= CN_THRESHOLDS.limit_down_ratio.high) {
      severity = 'warning'; direction = 'bearish';
      message = `Heavy limit-down: ${downRatio.toFixed(1)}% stocks`;
      messageCn = `跌停较重: ${downRatio.toFixed(1)}%股票跌停`;
    } else if (upRatio >= CN_THRESHOLDS.limit_up_ratio.critical) {
      severity = 'critical'; direction = 'bullish';
      message = `Limit-up frenzy: ${upRatio.toFixed(1)}% stocks limit-up, ${limitUp} stocks`;
      messageCn = `涨停潮: ${upRatio.toFixed(1)}%股票涨停, ${limitUp}只涨停`;
    } else if (upRatio >= CN_THRESHOLDS.limit_up_ratio.high) {
      severity = 'info'; direction = 'bullish';
      message = `Strong breadth: ${upRatio.toFixed(1)}% limit-up`;
      messageCn = `涨停活跃: ${upRatio.toFixed(1)}%涨停`;
    } else {
      message = `Normal breadth: ↑${limitUp} ↓${limitDown}`;
      messageCn = `涨跌停正常: ↑${limitUp} ↓${limitDown}`;
    }

    const signal: CnIndicatorSignal = {
      signalId: `cn_width_${Date.now()}`,
      category: 'market_width',
      indicator: 'limit_ratio',
      value: upRatio - downRatio,
      threshold: CN_THRESHOLDS.limit_up_ratio,
      severity, direction, message, messageCn,
      timestamp: Date.now(),
    };
    this.cnSignals_.push(signal);
    return signal;
  }

  /** Evaluate whale activity from 龙虎榜 */
  evaluateWhale(longhuBuyTotal: number, longhuSellTotal: number, topStockName: string): CnIndicatorSignal {
    const net = longhuBuyTotal - longhuSellTotal;
    const total = longhuBuyTotal + longhuSellTotal;
    
    let severity: CnIndicatorSignal['severity'] = 'info';
    let direction: CnIndicatorSignal['direction'] = 'neutral';

    if (net > 1000) { severity = 'critical'; direction = 'bullish'; }
    else if (net > 500) { severity = 'warning'; direction = 'bullish'; }
    else if (net < -1000) { severity = 'critical'; direction = 'bearish'; }
    else if (net < -500) { severity = 'warning'; direction = 'bearish'; }

    const signal: CnIndicatorSignal = {
      signalId: `cn_whale_${Date.now()}`,
      category: 'whale',
      indicator: 'longhu_net',
      value: net,
      threshold: { low: -500, high: 500, critical: null },
      severity, direction,
      message: `Longhu net: ${net > 0 ? '+' : ''}${net} 万 (B:${longhuBuyTotal} S:${longhuSellTotal}), top: ${topStockName}`,
      messageCn: `龙虎榜净买入: ${net > 0 ? '+' : ''}${net}万 (买:${longhuBuyTotal} 卖:${longhuSellTotal}), 首位:${topStockName}`,
      timestamp: Date.now(),
    };
    this.cnSignals_.push(signal);
    return signal;
  }

  // ── Cross-Market Comparison ────────────────────────────────────────────

  compareHkCn(params: {
    hkShortsellRatio: number;
    hkStockConnectNet: number;
    hkAdvancing: number;
    hkDeclining: number;
    cnNorthboundNet: number;
    cnDdxScore: number;
    cnLimitUp: number;
    cnLimitDown: number;
    cnTotalStocks: number;
  }): HkCnCrossComparison {
    const hkSentiment = this._hkSentimentScore(params);
    const cnSentiment = this._cnSentimentScore(params);
    const divergence = (hkSentiment > 30 && cnSentiment < -30) || (hkSentiment < -30 && cnSentiment > 30);

    // Simple correlation of flow directions
    const hkFlowDir = params.hkStockConnectNet > 0 ? 1 : -1;
    const cnFlowDir = params.cnNorthboundNet > 0 ? 1 : -1;
    const correlation = 0.6; // placeholder — real corr needs historical

    let riskLevel: HkCnCrossComparison['signals']['riskLevel'] = 'low';
    let summary = '';
    let summaryCn = '';

    const hkSeverity = this.evaluateShortsell(
      params.hkAdvancing + params.hkDeclining + params.cnTotalStocks,
      params.hkShortsellRatio * 1000
    );
    const cnSeverity = this.evaluateMarketWidth(params.cnLimitUp, params.cnLimitDown, params.cnTotalStocks);

    if (hkSeverity?.severity === 'critical' && cnSeverity.severity === 'critical') {
      riskLevel = 'extreme';
      summary = 'EXTREME RISK: Both HK shortsell and CN limit-down at critical levels';
      summaryCn = '极端风险: 港股卖空+A股跌停同时达临界';
    } else if (divergence && hkSentiment < -30 && cnSentiment > 30) {
      riskLevel = 'high';
      summary = 'HIGH DIVERGENCE: HK bearish, CN bullish — potential capital flight';
      summaryCn = '高度背离: 港股看空+A股看多 — 资金可能向A股转移';
    } else if (hkSeverity?.severity === 'warning' || cnSeverity.severity === 'warning') {
      riskLevel = 'medium';
      summary = 'Medium risk: mixed signals across HK/CN markets';
      summaryCn = '中等风险: HK/CN信号分歧';
    } else {
      riskLevel = 'low';
      summary = 'Low risk: HK and CN markets in sync';
      summaryCn = '低风险: HK/CN市场一致';
    }

    this.lastComparison_ = {
      timestamp: Date.now(),
      hk: {
        shortsellRatio: params.hkShortsellRatio,
        stockConnectNet: params.hkStockConnectNet,
        marketBreadth: params.hkDeclining > 0 ? params.hkAdvancing / params.hkDeclining : 99,
        sentimentScore: hkSentiment,
      },
      cn: {
        northboundNet: params.cnNorthboundNet,
        ddxScore: params.cnDdxScore,
        limitUpRatio: params.cnTotalStocks > 0 ? (params.cnLimitUp / params.cnTotalStocks) * 100 : 0,
        sentimenScore: cnSentiment,
      },
      signals: { divergence, correlation, riskLevel, summary, summaryCn },
    };
    return this.lastComparison_;
  }

  // ── Sentiment Scoring ──────────────────────────────────────────────────

  private _hkSentimentScore(p: { hkShortsellRatio: number; hkStockConnectNet: number; hkAdvancing: number; hkDeclining: number }): number {
    let score = 0;
    if (p.hkShortsellRatio < 15) score += 30;
    else if (p.hkShortsellRatio > 30) score -= 30;
    else score -= (p.hkShortsellRatio - 15) * 2;

    if (p.hkStockConnectNet > 500) score += 30;
    else if (p.hkStockConnectNet < -500) score -= 30;

    const adr = p.hkDeclining > 0 ? p.hkAdvancing / p.hkDeclining : 99;
    if (adr > 2) score += 20;
    else if (adr < 0.5) score -= 20;
    else score += (adr - 1) * 10;

    return Math.max(-100, Math.min(100, score));
  }

  private _cnSentimentScore(p: { cnNorthboundNet: number; cnDdxScore: number; cnLimitUp: number; cnLimitDown: number; cnTotalStocks: number }): number {
    let score = 0;
    if (p.cnNorthboundNet > 50) score += 30;
    else if (p.cnNorthboundNet < -50) score -= 30;
    else score += p.cnNorthboundNet * 0.3;

    if (p.cnDdxScore > 0.5) score += 30;
    else if (p.cnDdxScore < -0.5) score -= 30;
    else score += p.cnDdxScore * 30;

    const upRatio = p.cnTotalStocks > 0 ? (p.cnLimitUp / p.cnTotalStocks) * 100 : 0;
    const downRatio = p.cnTotalStocks > 0 ? (p.cnLimitDown / p.cnTotalStocks) * 100 : 0;
    if (downRatio > 5) score -= 40;
    else if (upRatio > 5) score += 40;
    else score += (upRatio - downRatio) * 5;

    return Math.max(-100, Math.min(100, score));
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getHkSignals(category?: HkIndicatorSignal['category'], limit = 50): HkIndicatorSignal[] {
    let results = [...this.hkSignals_];
    if (category) results = results.filter(s => s.category === category);
    return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  getCnSignals(category?: CnIndicatorSignal['category'], limit = 50): CnIndicatorSignal[] {
    let results = [...this.cnSignals_];
    if (category) results = results.filter(s => s.category === category);
    return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  getLatestComparison(): HkCnCrossComparison | null {
    return this.lastComparison_;
  }

  getAllSignals(): { hk: HkIndicatorSignal[]; cn: CnIndicatorSignal[]; cross: HkCnCrossComparison | null } {
    return {
      hk: this.hkSignals_.slice(-50),
      cn: this.cnSignals_.slice(-50),
      cross: this.lastComparison_,
    };
  }

  reset(): void {
    this.hkSignals_ = [];
    this.cnSignals_ = [];
    this.lastComparison_ = null;
  }
}

export const hkCnIndicatorBridge = new HkCnIndicatorBridge();
