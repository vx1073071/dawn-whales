// ── Risk Engine — risk engine v2 ──────────────────────────────────────────────
// v1: 7
// v2: + ATRstop loss + rollingCaps + Kelly + volatility
// orderrisk controlsubmit

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

interface RiskCheckResult {
  pass: boolean;
  reason?: string;
  warnings?: string[];
}

interface PositionSizeResult {
  qty: number;
  method: 'kelly' | 'atr' | 'fixed_pct' | 'vol_adjusted';
  kellyFraction?: number;
  riskAmount?: number;
  reasoning: string;
}

interface DrawdownState {
  peakEquity: number;
  currentDrawdownPct: number;
  maxDrawdownPct: number;
  drawdownStart?: number;
  isReduced: boolean;
  reductionFactor: number; // 1.0 = normal, 0.3 = reduced to 30%
}

interface RiskConfig {
 // ── v1 ──────────────────────────────────
  maxSinglePositionPct: number;  // 单品种最大占比 (20%)
  maxTotalPositionPct: number;   // 总position/holding最大占比 (80%, v2 从95%降至80%)
  dailyLossLimitPct: number;     // 日最大亏损 (5%)
  maxOrdersPerMinute: number;    // frequencylimit (10)
  maxOrderQty: number;           // 单笔最大数量
  minOrderQty: number;           // 单笔最小数量 (1)
  maxOrderValue: number;         // 单笔最大金额 (USD)
  tradingHoursOnly: boolean;     // 仅交易时段
  blacklist: string[];           // 禁止交易的标的

 // ── v2 risk control ──────────────────────────────────
 // ATR-based stop loss
  atrStopMultiplier: number;     // stop loss = ATR × 倍数 (2.0)
  atrTrailingEnabled: boolean;   // enable追踪stop loss

 // rolling Caps
  drawdownReduceThreshold: number;  // 回撤触发降仓 (15%)
  drawdownReduceFactor: number;     // 降仓至 (30%)
  drawdownRecoveryThreshold: number; // 回撤restore到 < 此值才解除降仓 (10%)

  // Kelly position management
  positionSizingMethod: 'kelly' | 'atr' | 'fixed_pct';
  kellyMaxFraction: number;      // Kelly 最大占比 (25%)
  kellyHalfEnabled: boolean;     // 使用 Half-Kelly（更保守）
  fixedPositionPct: number;      // 固定比例时每次用 (10%)
  atrRiskPerTrade: number;       // ATR-based: 每笔风险占比 (2%)

 // volatility
  volAdjustEnabled: boolean;     // enablevolatility调节
  vixHighThreshold: number;      // VIX 高volatilitythreshold (25)
  vixHighReduction: number;      // 高 VIX 降仓比例 (50%)
  vixExtremeThreshold: number;   // VIX 极端threshold (35)
  vixExtremeReduction: number;   // 极端 VIX 降仓比例 (75%)
}

const DEFAULT_CONFIG: RiskConfig = {
 // v1 default
  maxSinglePositionPct: 0.20,
  maxTotalPositionPct: 0.80,   // v2: 从 95% 降至 80%
  dailyLossLimitPct: 0.05,
  maxOrdersPerMinute: 10,
  maxOrderQty: 10000,
  minOrderQty: 1,
  maxOrderValue: 50000,
  tradingHoursOnly: true,
  blacklist: [],

 // v2 default
  atrStopMultiplier: 2.0,
  atrTrailingEnabled: true,

  drawdownReduceThreshold: 0.15,
  drawdownReduceFactor: 0.30,
  drawdownRecoveryThreshold: 0.10,

  positionSizingMethod: 'kelly',
  kellyMaxFraction: 0.25,
  kellyHalfEnabled: true,
  fixedPositionPct: 0.10,
  atrRiskPerTrade: 0.02,

  volAdjustEnabled: true,
  vixHighThreshold: 25,
  vixHighReduction: 0.50,
  vixExtremeThreshold: 35,
  vixExtremeReduction: 0.75,
};

// ── Risk Engine v2 ─────────────────────────────────────────────────────────

export class RiskEngine {
  private config: RiskConfig = { ...DEFAULT_CONFIG };
  private orderTimestamps: number[] = [];
  private dailyPnl = 0;
  private dailyPnlDate = '';
  private totalAssets = 0;
  private alerts: { time: number; type: string; message: string }[] = [];

 // ── v2: add new ────────────────────────────────
  private drawdownState: DrawdownState = {
    peakEquity: 0,
    currentDrawdownPct: 0,
    maxDrawdownPct: 0,
    isReduced: false,
    reductionFactor: 1.0,
  };

 // （ Kelly ）
  private tradeHistory: { pnl: number; isWin: boolean }[] = [];
  private readonly MAX_TRADE_HISTORY = 200;

 // current VIX 
  private currentVix: number | null = null;

 // ── Order Check (v1 7，) ──────────────────────────────

  checkOrder(order: unknown): RiskCheckResult {
    const warnings: string[] = [];

    // 1. Frequency limit
    const now = Date.now();
    this.orderTimestamps = this.orderTimestamps.filter((t) => now - t < 60000);
    if (this.orderTimestamps.length >= this.config.maxOrdersPerMinute) {
      this.addAlert('RATE_LIMIT', i18n.t('riskEngine.k1'));
      return { pass: false, reason: i18n.t('riskEngine.k2') };
    }

    // 2. Basic sanity checks
    if (!order.qty || order.qty <= 0) return { pass: false, reason: i18n.t('riskEngine.k3') };
    if (order.qty < this.config.minOrderQty) return { pass: false, reason: i18n.t('riskEngine.k4') };
    if (order.qty > this.config.maxOrderQty) return { pass: false, reason: i18n.t('riskEngine.k5') };

    if (order.price && order.price <= 0) return { pass: false, reason: i18n.t('riskEngine.k6') };

    // 3. Order value check
    const orderValue = (order.price || 0) * order.qty;
    if (orderValue > this.config.maxOrderValue) {
      return { pass: false, reason: i18n.t('riskEngine.k7') };
    }

    // 4. Blacklist check
    if (order.code && this.config.blacklist.includes(order.code)) {
      return { pass: false, reason: i18n.t('riskEngine.k8') };
    }

    // 5. Daily loss limit
    this.resetDailyPnl();
    if (this.totalAssets > 0 && this.dailyPnl < 0) {
      const lossPct = Math.abs(this.dailyPnl) / this.totalAssets;
      if (lossPct >= this.config.dailyLossLimitPct) {
        this.addAlert('DAILY_LOSS', i18n.t('riskEngine.k9'));
        return { pass: false, reason: i18n.t('riskEngine.k10') };
      }
      if (lossPct >= this.config.dailyLossLimitPct * 0.8) {
        warnings.push(i18n.t('riskEngine.k11'));
      }
    }

    // 6. Position concentration check
    if (this.totalAssets > 0 && orderValue > 0) {
      const positionPct = orderValue / this.totalAssets;
      if (positionPct > this.config.maxSinglePositionPct) {
        return { pass: false, reason: i18n.t('riskEngine.k12') };
      }
      if (positionPct > this.config.maxSinglePositionPct * 0.8) {
        warnings.push(i18n.t('riskEngine.k13'));
      }
    }

    // 7. Trading hours check (US market: 9:30-16:00 ET)
    if (this.config.tradingHoursOnly) {
      const now2 = new Date();
      const utcHour = now2.getUTCHours();
      const etHour = (utcHour - 4 + 24) % 24; // EDT = UTC-4
      const etMin = now2.getUTCMinutes();
      const etMinutes = etHour * 60 + etMin;
      const marketOpen = 9 * 60 + 30;   // 9:30 ET
      const marketClose = 16 * 60;       // 16:00 ET
      const day = now2.getUTCDay();

      if (day === 0 || day === 6) {
        warnings.push(i18n.t('riskEngine.k14'));
      } else if (etMinutes < marketOpen || etMinutes > marketClose) {
        warnings.push(i18n.t('riskEngine.k15'));
      }
    }

 // ── v2: risk check ──────────────────────────

 // 8. rolling
    if (this.drawdownState.isReduced) {
      warnings.push(i18n.t('riskEngine.k16'));
    }

 // 9. volatilitywarning
    if (this.config.volAdjustEnabled && this.currentVix !== null) {
      if (this.currentVix >= this.config.vixExtremeThreshold) {
        warnings.push(i18n.t('riskEngine.k17'));
      } else if (this.currentVix >= this.config.vixHighThreshold) {
        warnings.push(i18n.t('riskEngine.k18'));
      }
    }

    this.orderTimestamps.push(now);
    return { pass: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

 // ── v2: （add new） ──────────────────────────────────

  /**
 * 。strategy/policy order.qty=0 method。
   *
 * @param price current
 * @param atr current ATR ATR-based sizing）
 * @param stopPrice stop loss Kelly b ）
   * @returns           PositionSizeResult
   */
  calculatePositionSize(
    price: number,
    atr?: number,
    stopPrice?: number,
  ): PositionSizeResult {
    if (this.totalAssets <= 0 || price <= 0) {
      return { qty: 0, method: 'fixed_pct', reasoning: i18n.t('riskEngine.k19') };
    }

 //
    let availableCapital = this.totalAssets * this.config.maxTotalPositionPct;

 //
    if (this.drawdownState.isReduced) {
      availableCapital *= this.drawdownState.reductionFactor;
    }

 // volatility
    const volFactor = this.computeVolFactor();
    availableCapital *= volFactor;

    const method = this.config.positionSizingMethod;

    switch (method) {
      case 'kelly':
        return this.kellySizing(price, availableCapital, stopPrice);
      case 'atr':
        return this.atrSizing(price, availableCapital, atr);
      case 'fixed_pct':
      default:
        return this.fixedPctSizing(price, availableCapital);
    }
  }

  /**
   * Kelly Formula: f* = (bp - q) / b
 * b = (avgWin / avgLoss)
   * p = win rate
   * q = 1 - p
   *
 * Half-Kelly (f-star / 2) ， overbetting。
   */
  private kellySizing(
    price: number,
    availableCapital: number,
    stopPrice?: number,
  ): PositionSizeResult {
    const history = this.tradeHistory;

    if (history.length < 10) {
 // ，downgrade fixed_pct
      log.info(i18n.t('riskEngine.k20'));
      return this.fixedPctSizing(price, availableCapital);
    }

    const wins = history.filter((t) => t.isWin);
    const losses = history.filter((t) => !t.isWin);

    if (wins.length === 0 || losses.length === 0) {
      return this.fixedPctSizing(price, availableCapital);
    }

    const winRate = wins.length / history.length;
    const avgWin = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length);

    if (avgLoss === 0) {
      return this.fixedPctSizing(price, availableCapital);
    }

    const b = avgWin / avgLoss; // 赔率
    const p = winRate;
    const q = 1 - p;

    // Full Kelly
    let kellyFraction = (b * p - q) / b;

 // limit Kelly 
    kellyFraction = Math.min(kellyFraction, this.config.kellyMaxFraction);
    kellyFraction = Math.max(kellyFraction, 0); // 不允许负值

 // Half-Kelly ()
    if (this.config.kellyHalfEnabled) {
      kellyFraction *= 0.5;
    }

    const riskAmount = availableCapital * kellyFraction;
    const qty = Math.floor(riskAmount / price);

    log.info(
      `[RiskEngine] Kelly: f*=${kellyFraction.toFixed(4)}, winRate=${(winRate * 100).toFixed(1)}%, ` +
      `b=${b.toFixed(2)}, qty=${qty}, riskAmount=$${riskAmount.toFixed(0)}`
    );

    return {
      qty: Math.max(qty, 0),
      method: 'kelly',
      kellyFraction,
      riskAmount,
      reasoning: i18n.t('riskEngine.k21'),
    };
  }

  /**
   * ATR-based Sizing: qty = riskAmount / (ATR × multiplier)
   * riskAmount = totalAssets × atrRiskPerTrade (default2%)
   */
  private atrSizing(
    price: number,
    availableCapital: number,
    atr?: number,
  ): PositionSizeResult {
    if (!atr || atr <= 0) {
      log.info(i18n.t('riskEngine.k22'));
      return this.fixedPctSizing(price, availableCapital);
    }

    const riskAmount = this.totalAssets * this.config.atrRiskPerTrade;
    const riskPerShare = atr * this.config.atrStopMultiplier;
    const qty = Math.floor(riskAmount / riskPerShare);

 //
    const maxQty = Math.floor(availableCapital / price);
    const finalQty = Math.min(qty, maxQty);

    log.info(
      `[RiskEngine] ATR: riskAmount=$${riskAmount.toFixed(0)}, ` +
      `ATR=${atr.toFixed(2)}, riskPerShare=$${riskPerShare.toFixed(2)}, qty=${finalQty}`
    );

    return {
      qty: Math.max(finalQty, 0),
      method: 'atr',
      riskAmount,
      reasoning: i18n.t('riskEngine.k23'),
    };
  }

  /**
 * Fixed Percentage: availableCapital fixedPositionPct (default10%)
   */
  private fixedPctSizing(
    price: number,
    availableCapital: number,
  ): PositionSizeResult {
    const riskAmount = availableCapital * this.config.fixedPositionPct;
    const qty = Math.floor(riskAmount / price);

    return {
      qty: Math.max(qty, 0),
      method: 'fixed_pct',
      riskAmount,
      reasoning: i18n.t('riskEngine.k24'),
    };
  }

 // ── v2: ATR stop loss ──────────────────────────────────────────

  /**
 * ATR-based stop loss
 * stop loss = entryPrice - ATR × multiplier
   *
 * @param entryPrice 
   * @param atr         current ATR
   * @param side        'LONG' | 'SHORT'
 * @returns stop loss
   */
  calculateDynamicStopLoss(
    entryPrice: number,
    atr: number,
    side: 'LONG' | 'SHORT' = 'LONG',
  ): number {
    const offset = atr * this.config.atrStopMultiplier;

    if (side === 'LONG') {
      const stopLoss = entryPrice - offset;
      log.info(`[RiskEngine] ATR StopLoss: ${entryPrice.toFixed(2)} - ${offset.toFixed(2)} = ${stopLoss.toFixed(2)}`);
      return stopLoss;
    } else {
      const stopLoss = entryPrice + offset;
      log.info(`[RiskEngine] ATR StopLoss: ${entryPrice.toFixed(2)} + ${offset.toFixed(2)} = ${stopLoss.toFixed(2)}`);
      return stopLoss;
    }
  }

  /**
 * updatestop loss。stop loss 
   *
 * @param currentStop currentstop loss
 * @param currentPrice current
   * @param atr          current ATR
   * @param side         'LONG' | 'SHORT'
 * @returns stop loss
   */
  updateTrailingStop(
    currentStop: number,
    currentPrice: number,
    atr: number,
    side: 'LONG' | 'SHORT' = 'LONG',
  ): number {
    if (!this.config.atrTrailingEnabled) return currentStop;

    const offset = atr * this.config.atrStopMultiplier;

    if (side === 'LONG') {
      const newStop = currentPrice - offset;
      if (newStop > currentStop) {
        log.info(i18n.t('riskEngine.k25'));
        return newStop;
      }
    } else {
      const newStop = currentPrice + offset;
      if (newStop < currentStop) {
        log.info(i18n.t('riskEngine.k26'));
        return newStop;
      }
    }

    return currentStop;
  }

 // ── v2: rolling ──────────────────────────────────────────

  /**
 * update。
 * strategy/policy onQuoteUpdate 。
   *
 * @param currentEquity current (cash + position value)
   */
  updateEquity(currentEquity: number): void {
    const dd = this.drawdownState;

 // update
    if (currentEquity > dd.peakEquity) {
      dd.peakEquity = currentEquity;
      dd.drawdownStart = undefined;
    }

 // current
    if (dd.peakEquity > 0) {
      dd.currentDrawdownPct = (dd.peakEquity - currentEquity) / dd.peakEquity;
    }

 // updatemax drawdown
    if (dd.currentDrawdownPct > dd.maxDrawdownPct) {
      dd.maxDrawdownPct = dd.currentDrawdownPct;
      if (!dd.drawdownStart) dd.drawdownStart = Date.now();
    }

 //
    if (!dd.isReduced && dd.currentDrawdownPct >= this.config.drawdownReduceThreshold) {
      dd.isReduced = true;
      dd.reductionFactor = this.config.drawdownReduceFactor;
      this.addAlert(
        'DRAWDOWN_REDUCE',
        i18n.t('riskEngine.k27')
      );
      log.warn(
        `[RiskEngine] 🔴 Drawdown ${(dd.currentDrawdownPct * 100).toFixed(1)}% → ` +
        `Position reduced to ${(dd.reductionFactor * 100).toFixed(0)}%`
      );
    }

 //
    if (dd.isReduced && dd.currentDrawdownPct < this.config.drawdownRecoveryThreshold) {
      dd.isReduced = false;
      dd.reductionFactor = 1.0;
      this.addAlert(
        'DRAWDOWN_RECOVERY',
        i18n.t('riskEngine.k28')
      );
      log.info(`[RiskEngine] ✅ Drawdown recovered → Position limits removed`);
    }
  }

  /**
 * current（ UI ）
   */
  getDrawdownState(): DrawdownState {
    return { ...this.drawdownState };
  }

 // ── v2: volatility ──────────────────────────────────────────

  /**
 * update VIX 。market datamodule。
   */
  updateVix(vix: number): void {
    this.currentVix = vix;
  }

  /**
 * VIX factor。
 * VIX < 25 → factor = 1.0 ()
 * VIX 25-35 → factor = 0.5 ()
 * VIX > 35 → factor = 0.25 (1/4)
   */
  private computeVolFactor(): number {
    if (!this.config.volAdjustEnabled || this.currentVix === null) return 1.0;
    const vix = this.currentVix;
    if (vix >= this.config.vixExtremeThreshold) return 1 - this.config.vixExtremeReduction;
    if (vix >= this.config.vixHighThreshold) return 1 - this.config.vixHighReduction;
    return 1.0;
  }

  /**
 * currentvolatilityfactor（ UI ）
   */
  getVolatilityFactor(): number {
    return this.computeVolFactor();
  }

 // ── v2: （Kelly ） ──────────────────────────

  /**
 * 。strategy/policyclose position。
   */
  recordTrade(pnl: number): void {
    this.tradeHistory.push({ pnl, isWin: pnl > 0 });
    if (this.tradeHistory.length > this.MAX_TRADE_HISTORY) {
      this.tradeHistory.shift();
    }
  }

  /**
 * Kelly （ UI ）
   */
  getKellyStats(): {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    kellyFraction: number;
    sampleSize: number;
  } {
    const history = this.tradeHistory;
    if (history.length === 0) {
      return { winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, kellyFraction: 0, sampleSize: 0 };
    }

    const wins = history.filter((t) => t.isWin);
    const losses = history.filter((t) => !t.isWin);
    const winRate = wins.length / history.length;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const b = avgLoss > 0 ? avgWin / avgLoss : 0;
    let kellyFraction = b > 0 ? (b * winRate - (1 - winRate)) / b : 0;
    kellyFraction = Math.max(0, Math.min(kellyFraction, this.config.kellyMaxFraction));
    if (this.config.kellyHalfEnabled) kellyFraction *= 0.5;

    return { winRate, avgWin, avgLoss, profitFactor, kellyFraction, sampleSize: history.length };
  }

 // ── State Updates (v1 ) ──────────────────────────────────

  updateTotalAssets(value: number) {
    this.totalAssets = value;
  }

  updateDailyPnl(pnl: number) {
    this.resetDailyPnl();
    this.dailyPnl = pnl;
  }

  private resetDailyPnl() {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyPnlDate !== today) {
      this.dailyPnl = 0;
      this.dailyPnlDate = today;
    }
  }

  // ── Config ──────────────────────────────────────────────────────

  getConfig(): RiskConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<RiskConfig>) {
    Object.assign(this.config, config);
    log.info('[RiskEngine] Config updated:', this.config);
  }

  // ── Alerts ──────────────────────────────────────────────────────

  private addAlert(type: string, message: string) {
    this.alerts.push({ time: Date.now(), type, message });
    if (this.alerts.length > 100) this.alerts.shift();
    log.warn(`[RiskEngine] Alert: ${type} — ${message}`);
  }

  getAlerts(limit = 20): { time: number; type: string; message: string }[] {
    return this.alerts.slice(-limit);
  }

  clearAlerts() {
    this.alerts = [];
  }

 // ── v2: （ IPC UI） ─────────────────────

  getStatusSnapshot(): {
    config: RiskConfig;
    drawdown: DrawdownState;
    kelly: ReturnType<RiskEngine['getKellyStats']>;
    volatilityFactor: number;
    currentVix: number | null;
    totalAssets: number;
    dailyPnl: number;
    alerts: ReturnType<RiskEngine['getAlerts']>;
  } {
    return {
      config: this.getConfig(),
      drawdown: this.getDrawdownState(),
      kelly: this.getKellyStats(),
      volatilityFactor: this.computeVolFactor(),
      currentVix: this.currentVix,
      totalAssets: this.totalAssets,
      dailyPnl: this.dailyPnl,
      alerts: this.getAlerts(),
    };
  }
}
