/**
 * R278 auto#2b: CBOE 期权/波动率数据源桥接 (CBOEDataSource) v1.0
 * 
 * QUANT MOO — 桥接 CBOE 期权市场数据 → 因子信号管线
 * 
 * 数据覆盖:
 *   Volatility Indices:
 *     · VIX / VIX9D / VIX3M / VIX6M (SPX 隐含波动率)
 *     · VXN (Nasdaq-100) / RVX (Russell 2000)
 *     · VXD (DJIA) / OVX (Crude Oil) / GVZ (Gold)
 *     · EUVIX (Euro STOXX 50) / VXEFA (EFA)
 * 
 *   Skew / Term Structure:
 *     · SKEW (CBOE Skew Index — tail risk)
 *     · VIX Term Structure (Contango/Backwardation)
 *     · VIX Futures Curve
 * 
 *   Options Flow:
 *     · Put/Call Ratio (Equity / Index / Total)
 *     · Options Volume by strike / expiry
 *     · Open Interest concentration
 *     · VIX options & futures volume
 * 
 *   Core Functions:
 *     1. VIX family data ingest & signal generation
 *     2. Put/Call ratio monitoring
 *     3. Volatility term structure analysis
 *     4. Tail risk / SKEW monitoring
 *     5. Options flow sentiment
 *     6. VIX futures curve analysis
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type CBOEIndexType = 'volatility' | 'skew' | 'term_structure' | 'put_call' | 'futures';

export interface CBOEVolatilitySnapshot {
  timestamp: number;
  vix: number;
  vix9d: number | null;
  vix3m: number | null;
  vix6m: number | null;
  vxn: number | null;      // Nasdaq-100 vol
  rvx: number | null;      // Russell 2000 vol
  vxd: number | null;      // DJIA vol
  ovx: number | null;      // Crude Oil vol
  gvz: number | null;      // Gold vol
  euvix: number | null;    // Euro STOXX 50 vol
}

export interface CBOESkewSnapshot {
  timestamp: number;
  skew: number;            // CBOE SKEW Index (100-150, >130=tail risk elevated)
  skewSignal: 'normal' | 'elevated' | 'extreme';
}

export interface CBOEPutCallSnapshot {
  timestamp: number;
  equityPCR: number;       // Equity-only P/C ratio
  indexPCR: number;        // Index P/C ratio
  totalPCR: number;        // Total P/C ratio
  pcrSignal: 'oversold' | 'neutral' | 'overbought';
}

export interface CBOETermStructure {
  timestamp: number;
  spot: number;            // Spot VIX
  m1: number;              // Front month VIX futures
  m2: number;              // Second month
  m3: number | null;       // Third month
  m4: number | null;       // Fourth month
  contango: number;        // M1 - Spot (positive = contango)
  rollYield: number;       // (M1 - M2) / M2
  regime: 'contango' | 'backwardation' | 'flat';
}

export interface CBOEFuturesCurve {
  timestamp: number;
  points: Array<{ month: string; price: number; expiry: string }>;
  slope: 'upward' | 'downward' | 'flat';
  steepness: number;       // M4-M1 spread
}

export interface CBOESignal {
  signalId: string;
  type: 'vix_spike' | 'vix_collapse' | 'skew_alert' | 'pcr_extreme'
      | 'term_structure' | 'backwardation' | 'contango_steep'
      | 'cross_asset_vol' | 'vol_regime_change';
  severity: 'info' | 'warning' | 'critical';
  direction: 'bullish' | 'bearish' | 'neutral';
  message: string;
  messageCn: string;
  value: number;
  timestamp: number;
}

export interface CBOEStats {
  lastUpdate: number;
  signalCount: number;
  vixCurrent: number;
  vixHigh20d: number;
  vixLow20d: number;
  skewCurrent: number;
  pcrCurrent: number;
  termRegime: CBOETermStructure['regime'];
}

// ── CBOEDataSource ─────────────────────────────────────────────────────────

export class CBOEDataSource {
  // Data caches
  private volatility: CBOEVolatilitySnapshot | null = null;
  private skewData: CBOESkewSnapshot | null = null;
  private putCallData: CBOEPutCallSnapshot | null = null;
  private termStructure: CBOETermStructure | null = null;
  private futuresCurve: CBOEFuturesCurve | null = null;
  
  // History for VIX range tracking
  private vixHistory: number[] = [];
  
  // Signals
  private signals: CBOESignal[] = [];
  
  // Stats
  private stats: CBOEStats = {
    lastUpdate: 0, signalCount: 0,
    vixCurrent: 0, vixHigh20d: 0, vixLow20d: 0,
    skewCurrent: 0, pcrCurrent: 0, termRegime: 'flat',
  };
  
  private signalHandlers: Array<(signal: CBOESignal) => void> = [];

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Data Ingestion
  // ═══════════════════════════════════════════════════════════════════════

  /** Ingest VIX volatility family data */
  ingestVolatility(data: CBOEVolatilitySnapshot): void {
    const prevVix = this.volatility?.vix;
    this.volatility = data;
    this.stats.lastUpdate = Date.now();
    this.stats.vixCurrent = data.vix;
    
    // Track VIX history
    this.vixHistory.push(data.vix);
    if (this.vixHistory.length > 20) this.vixHistory = this.vixHistory.slice(-20);
    this.stats.vixHigh20d = Math.max(...this.vixHistory);
    this.stats.vixLow20d = Math.min(...this.vixHistory);
    
    this._detectVolatilitySignals(data, prevVix);
  }

  /** Ingest SKEW data */
  ingestSkew(data: CBOESkewSnapshot): void {
    this.skewData = data;
    this.stats.lastUpdate = Date.now();
    this.stats.skewCurrent = data.skew;
    this._detectSkewSignals(data);
  }

  /** Ingest Put/Call ratio data */
  ingestPutCall(data: CBOEPutCallSnapshot): void {
    this.putCallData = data;
    this.stats.lastUpdate = Date.now();
    this.stats.pcrCurrent = data.totalPCR;
    this._detectPCRSignals(data);
  }

  /** Ingest VIX term structure */
  ingestTermStructure(data: CBOETermStructure): void {
    this.termStructure = data;
    this.stats.termRegime = data.regime;
    this.stats.lastUpdate = Date.now();
    this._detectTermStructureSignals(data);
  }

  /** Ingest VIX futures curve */
  ingestFuturesCurve(data: CBOEFuturesCurve): void {
    this.futuresCurve = data;
    this.stats.lastUpdate = Date.now();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Query
  // ═══════════════════════════════════════════════════════════════════════

  getVolatility(): CBOEVolatilitySnapshot | null { return this.volatility; }
  getSkew(): CBOESkewSnapshot | null { return this.skewData; }
  getPutCall(): CBOEPutCallSnapshot | null { return this.putCallData; }
  getTermStructure(): CBOETermStructure | null { return this.termStructure; }
  getFuturesCurve(): CBOEFuturesCurve | null { return this.futuresCurve; }

  /** Get VIX percentile over last 20 days */
  getVIXPercentile(): number {
    if (this.vixHistory.length < 5) return 50;
    const current = this.vixHistory[this.vixHistory.length - 1];
    const lower = this.vixHistory.filter(v => v < current).length;
    return Math.round(lower / this.vixHistory.length * 100);
  }

  /** Get current volatility regime classification */
  getVolRegime(): 'low' | 'normal' | 'elevated' | 'high' | 'extreme' {
    const vix = this.volatility?.vix;
    if (!vix) return 'normal';
    if (vix < 13) return 'low';
    if (vix < 20) return 'normal';
    if (vix < 28) return 'elevated';
    if (vix < 35) return 'high';
    return 'extreme';
  }

  /** Get VIX term structure analysis */
  getTermAnalysis(): { state: string; stateCn: string; implication: string } | null {
    const ts = this.termStructure;
    if (!ts) return null;
    
    if (ts.regime === 'contango') {
      if (ts.contango > 3) return { state: 'Steep Contango', stateCn: '陡峭升水', implication: 'VIX期货大幅升水 → 市场预期短期平静，但远期中度焦虑' };
      return { state: 'Normal Contango', stateCn: '正常升水', implication: 'VIX期货正常升水 → 市场预期稳定，适合卖出波动率' };
    } else if (ts.regime === 'backwardation') {
      return { state: 'Backwardation', stateCn: '贴水(现货溢价)', implication: 'VIX现货 > 期货 → 市场短期极度恐慌，需立即防御' };
    }
    return { state: 'Flat', stateCn: '水平', implication: 'VIX期限结构平坦 → 不确定性高，方向待定' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Sentiment Composite
  // ═══════════════════════════════════════════════════════════════════════

  /** Compute options market sentiment composite (-100=fear, +100=greed) */
  computeSentiment(): number {
    let score = 0;
    let weight = 0;

    // 1. VIX level (inverse)
    if (this.volatility) {
      const vixSent = this.volatility.vix < 15 ? 30 : this.volatility.vix < 20 ? 10 : this.volatility.vix < 28 ? -20 : -40;
      score += vixSent * 0.30;
      weight += 0.30;
    }

    // 2. SKEW (tail risk — inverse)
    if (this.skewData) {
      const skewSent = this.skewData.skew > 135 ? -30 : this.skewData.skew > 125 ? -10 : 10;
      score += skewSent * 0.20;
      weight += 0.20;
    }

    // 3. P/C Ratio (inverse)
    if (this.putCallData) {
      const pcrSent = this.putCallData.totalPCR > 1.0 ? -20 : this.putCallData.totalPCR > 0.8 ? 0 : 20;
      score += pcrSent * 0.25;
      weight += 0.25;
    }

    // 4. Term structure regime
    if (this.termStructure) {
      const tsSent = this.termStructure.regime === 'backwardation' ? -25 : this.termStructure.regime === 'contango' ? 15 : 0;
      score += tsSent * 0.25;
      weight += 0.25;
    }

    return weight > 0 ? Math.round(score / weight) : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Signals / Stats / Handlers
  // ═══════════════════════════════════════════════════════════════════════

  getSignals(limit = 50): CBOESignal[] { return this.signals.slice(0, limit); }
  getStats(): CBOEStats { return { ...this.stats }; }

  onSignal(handler: (signal: CBOESignal) => void): () => void {
    this.signalHandlers.push(handler);
    return () => { const idx = this.signalHandlers.indexOf(handler); if (idx >= 0) this.signalHandlers.splice(idx, 1); };
  }

  reset(): void {
    this.volatility = null; this.skewData = null; this.putCallData = null;
    this.termStructure = null; this.futuresCurve = null;
    this.vixHistory = []; this.signals = [];
    this.stats = { lastUpdate: 0, signalCount: 0, vixCurrent: 0, vixHigh20d: 0, vixLow20d: 0, skewCurrent: 0, pcrCurrent: 0, termRegime: 'flat' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Signal Detection
  // ═══════════════════════════════════════════════════════════════════════

  private _detectVolatilitySignals(data: CBOEVolatilitySnapshot, prevVix?: number): void {
    // VIX spike
    if (data.vix > 30) {
      const sev = data.vix > 40 ? 'critical' : 'warning';
      this._emitSignal('vix_spike', sev, 'bearish', data.vix,
        `VIX surged to ${data.vix.toFixed(1)} — extreme fear in equity markets`,
        `VIX飙升 ${data.vix.toFixed(1)} — 市场极度恐慌`,
      );
    }

    // VIX regime change
    if (prevVix !== undefined && Math.abs(data.vix - prevVix) > 5) {
      const dir = data.vix > prevVix ? 'bearish' : 'bullish';
      this._emitSignal('vol_regime_change', 'warning', dir, Math.abs(data.vix - prevVix),
        `VIX regime shift: ${data.vix > prevVix ? 'spiked' : 'plunged'} by ${Math.abs(data.vix - prevVix).toFixed(1)} points — volatility regime change`,
        `VIX大幅变动 ${Math.abs(data.vix - prevVix).toFixed(1)}点 — 波动率体系切换`,
      );
    }

    // Cross-asset volatility divergence
    if (data.vix > 25 && data.ovx && data.ovx < 20) {
      this._emitSignal('cross_asset_vol', 'warning', 'neutral', 0,
        `Equity VIX elevated (${data.vix.toFixed(1)}) while Crude Oil VIX calm (${data.ovx.toFixed(1)}) — divergent risk pricing`,
        `股票VIX偏高(${data.vix.toFixed(1)})但原油VIX偏低(${data.ovx.toFixed(1)}) — 风险定价分歧`,
      );
    }
  }

  private _detectSkewSignals(data: CBOESkewSnapshot): void {
    if (data.skew > 140) {
      this._emitSignal('skew_alert', 'critical', 'bearish', data.skew,
        `CBOE SKEW at ${data.skew} — extreme tail risk hedging, crash insurance demand surging`,
        `SKEW指数 ${data.skew} — 尾部风险对冲极端，崩盘保护需求激增`,
      );
    } else if (data.skew > 130) {
      this._emitSignal('skew_alert', 'warning', 'bearish', data.skew,
        `CBOE SKEW elevated at ${data.skew} — investors paying premium for downside protection`,
        `SKEW指数偏高 ${data.skew} — 投资者溢价购买下行保护`,
      );
    }
  }

  private _detectPCRSignals(data: CBOEPutCallSnapshot): void {
    if (data.totalPCR > 1.2) {
      this._emitSignal('pcr_extreme', 'critical', 'bullish', data.totalPCR,
        `Put/Call ratio extreme at ${data.totalPCR.toFixed(2)} — excessively bearish positioning, contrarian buy signal`,
        `Put/Call比极端 ${data.totalPCR.toFixed(2)} — 过度看空持仓，反向买入信号`,
      );
    } else if (data.totalPCR < 0.5) {
      this._emitSignal('pcr_extreme', 'warning', 'bearish', data.totalPCR,
        `Put/Call ratio very low at ${data.totalPCR.toFixed(2)} — excessively bullish positioning, complacency risk`,
        `Put/Call比极低 ${data.totalPCR.toFixed(2)} — 过度看多持仓，自满风险`,
      );
    }
  }

  private _detectTermStructureSignals(data: CBOETermStructure): void {
    if (data.regime === 'backwardation') {
      this._emitSignal('backwardation', data.contango < -3 ? 'critical' : 'warning', 'bearish', data.contango,
        `VIX curve inverted — backwardation of ${Math.abs(data.contango).toFixed(1)} points, market stress elevated`,
        `VIX曲线倒挂 — 贴水 ${Math.abs(data.contango).toFixed(1)}点，市场压力高`,
      );
    }
    if (data.regime === 'contango' && data.contango > 5) {
      this._emitSignal('contango_steep', 'info', 'neutral', data.contango,
        `VIX curve steep contango (${data.contango.toFixed(1)}) — favorable for volatility selling strategies`,
        `VIX陡峭升水(${data.contango.toFixed(1)}) — 利于卖出波动率策略`,
      );
    }
  }

  private _emitSignal(
    type: CBOESignal['type'], severity: 'info' | 'warning' | 'critical',
    direction: 'bullish' | 'bearish' | 'neutral', value: number,
    message: string, messageCn: string,
  ): void {
    const signal: CBOESignal = {
      signalId: `cboe_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type, severity, direction, message, messageCn, value, timestamp: Date.now(),
    };
    this.signals.unshift(signal);
    if (this.signals.length > 500) this.signals = this.signals.slice(0, 500);
    this.stats.signalCount++;
    for (const h of this.signalHandlers) { try { h(signal); } catch { /* non-fatal */ } }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _cboeSource: CBOEDataSource | null = null;

export function getCBOESource(): CBOEDataSource {
  if (!_cboeSource) _cboeSource = new CBOEDataSource();
  return _cboeSource;
}

export function resetCBOESource(): void {
  if (_cboeSource) _cboeSource.reset();
  _cboeSource = null;
}
