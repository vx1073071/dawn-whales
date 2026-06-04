// ── Risk Engine — 风控引擎 v2 ──────────────────────────────────────────────
// v1: 7项静态检查
// v2: + ATR动态止损 + 滚动回撤Caps + Kelly仓位 + 波动率调节
// 每笔订单必须通过风控才能提交

import log from 'electron-log';

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
  // ── v1 静态检查 ──────────────────────────────────
  maxSinglePositionPct: number;  // 单品种最大占比 (20%)
  maxTotalPositionPct: number;   // 总持仓最大占比 (80%, v2 从95%降至80%)
  dailyLossLimitPct: number;     // 日最大亏损 (5%)
  maxOrdersPerMinute: number;    // 频率限制 (10)
  maxOrderQty: number;           // 单笔最大数量
  minOrderQty: number;           // 单笔最小数量 (1)
  maxOrderValue: number;         // 单笔最大金额 (USD)
  tradingHoursOnly: boolean;     // 仅交易时段
  blacklist: string[];           // 禁止交易的标的

  // ── v2 动态风控 ──────────────────────────────────
  // ATR-based 动态止损
  atrStopMultiplier: number;     // 止损 = ATR × 倍数 (2.0)
  atrTrailingEnabled: boolean;   // 启用追踪止损

  // 滚动回撤 Caps
  drawdownReduceThreshold: number;  // 回撤触发降仓 (15%)
  drawdownReduceFactor: number;     // 降仓至 (30%)
  drawdownRecoveryThreshold: number; // 回撤恢复到 < 此值才解除降仓 (10%)

  // Kelly 仓位管理
  positionSizingMethod: 'kelly' | 'atr' | 'fixed_pct';
  kellyMaxFraction: number;      // Kelly 最大占比 (25%)
  kellyHalfEnabled: boolean;     // 使用 Half-Kelly（更保守）
  fixedPositionPct: number;      // 固定比例时每次用 (10%)
  atrRiskPerTrade: number;       // ATR-based: 每笔风险占比 (2%)

  // 波动率调节
  volAdjustEnabled: boolean;     // 启用波动率调节
  vixHighThreshold: number;      // VIX 高波动率阈值 (25)
  vixHighReduction: number;      // 高 VIX 降仓比例 (50%)
  vixExtremeThreshold: number;   // VIX 极端阈值 (35)
  vixExtremeReduction: number;   // 极端 VIX 降仓比例 (75%)
}

const DEFAULT_CONFIG: RiskConfig = {
  // v1 默认值
  maxSinglePositionPct: 0.20,
  maxTotalPositionPct: 0.80,   // v2: 从 95% 降至 80%
  dailyLossLimitPct: 0.05,
  maxOrdersPerMinute: 10,
  maxOrderQty: 10000,
  minOrderQty: 1,
  maxOrderValue: 50000,
  tradingHoursOnly: true,
  blacklist: [],

  // v2 默认值
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

  // ── v2: 新增状态 ────────────────────────────────
  private drawdownState: DrawdownState = {
    peakEquity: 0,
    currentDrawdownPct: 0,
    maxDrawdownPct: 0,
    isReduced: false,
    reductionFactor: 1.0,
  };

  // 交易历史（用于 Kelly 计算）
  private tradeHistory: { pnl: number; isWin: boolean }[] = [];
  private readonly MAX_TRADE_HISTORY = 200;

  // 当前 VIX 值
  private currentVix: number | null = null;

  // ── Order Check (v1 7项检查，保留) ──────────────────────────────

  checkOrder(order: any): RiskCheckResult {
    const warnings: string[] = [];

    // 1. Frequency limit
    const now = Date.now();
    this.orderTimestamps = this.orderTimestamps.filter((t) => now - t < 60000);
    if (this.orderTimestamps.length >= this.config.maxOrdersPerMinute) {
      this.addAlert('RATE_LIMIT', '下单频率过高（每分钟最多10单）');
      return { pass: false, reason: '下单频率过高（每分钟最多10单）' };
    }

    // 2. Basic sanity checks
    if (!order.qty || order.qty <= 0) return { pass: false, reason: '数量必须大于0' };
    if (order.qty < this.config.minOrderQty) return { pass: false, reason: `数量不得少于 ${this.config.minOrderQty}` };
    if (order.qty > this.config.maxOrderQty) return { pass: false, reason: `数量不得超过 ${this.config.maxOrderQty}` };

    if (order.price && order.price <= 0) return { pass: false, reason: '价格必须大于0' };

    // 3. Order value check
    const orderValue = (order.price || 0) * order.qty;
    if (orderValue > this.config.maxOrderValue) {
      return { pass: false, reason: `单笔金额 $${orderValue.toFixed(0)} 超过上限 $${this.config.maxOrderValue}` };
    }

    // 4. Blacklist check
    if (order.code && this.config.blacklist.includes(order.code)) {
      return { pass: false, reason: `${order.code} 在禁止交易名单中` };
    }

    // 5. Daily loss limit
    this.resetDailyPnl();
    if (this.totalAssets > 0 && this.dailyPnl < 0) {
      const lossPct = Math.abs(this.dailyPnl) / this.totalAssets;
      if (lossPct >= this.config.dailyLossLimitPct) {
        this.addAlert('DAILY_LOSS', `日亏损 ${(lossPct * 100).toFixed(2)}% 已达上限`);
        return { pass: false, reason: `日亏损 ${(lossPct * 100).toFixed(1)}% 已超过 ${this.config.dailyLossLimitPct * 100}% 上限` };
      }
      if (lossPct >= this.config.dailyLossLimitPct * 0.8) {
        warnings.push(`⚠️ 日亏损 ${(lossPct * 100).toFixed(1)}%，接近上限`);
      }
    }

    // 6. Position concentration check
    if (this.totalAssets > 0 && orderValue > 0) {
      const positionPct = orderValue / this.totalAssets;
      if (positionPct > this.config.maxSinglePositionPct) {
        return { pass: false, reason: `单品种占比 ${(positionPct * 100).toFixed(1)}% 超过 ${this.config.maxSinglePositionPct * 100}% 上限` };
      }
      if (positionPct > this.config.maxSinglePositionPct * 0.8) {
        warnings.push(`⚠️ 单品种占比 ${(positionPct * 100).toFixed(1)}%，接近上限`);
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
        warnings.push('⚠️ 周末，市场休市');
      } else if (etMinutes < marketOpen || etMinutes > marketClose) {
        warnings.push('⚠️ 非交易时段，订单将在开盘后执行');
      }
    }

    // ── v2: 动态风控检查 ──────────────────────────

    // 8. 滚动回撤检查
    if (this.drawdownState.isReduced) {
      warnings.push(`🔴 回撤降仓模式: 仓位限制为 ${this.drawdownState.reductionFactor * 100}%`);
    }

    // 9. 高波动率警告
    if (this.config.volAdjustEnabled && this.currentVix !== null) {
      if (this.currentVix >= this.config.vixExtremeThreshold) {
        warnings.push(`🔴 VIX=${this.currentVix.toFixed(1)} 极端波动，仓位限制 ${(1 - this.config.vixExtremeReduction) * 100}%`);
      } else if (this.currentVix >= this.config.vixHighThreshold) {
        warnings.push(`🟡 VIX=${this.currentVix.toFixed(1)} 高波动，仓位限制 ${(1 - this.config.vixHighReduction) * 100}%`);
      }
    }

    this.orderTimestamps.push(now);
    return { pass: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  // ── v2: 仓位计算（核心新增） ──────────────────────────────────

  /**
   * 计算建议下单量。策略引擎生成 order.qty=0 时调用此方法。
   *
   * @param price       当前价格
   * @param atr         当前 ATR 值（可选，用于 ATR-based sizing）
   * @param stopPrice   止损价（可选，用于 Kelly 的 b 计算）
   * @returns           PositionSizeResult
   */
  calculatePositionSize(
    price: number,
    atr?: number,
    stopPrice?: number,
  ): PositionSizeResult {
    if (this.totalAssets <= 0 || price <= 0) {
      return { qty: 0, method: 'fixed_pct', reasoning: '资产或价格为零' };
    }

    // 获取基础可用资金
    let availableCapital = this.totalAssets * this.config.maxTotalPositionPct;

    // 回撤降仓
    if (this.drawdownState.isReduced) {
      availableCapital *= this.drawdownState.reductionFactor;
    }

    // 波动率调节
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
   * b = 赔率 (avgWin / avgLoss)
   * p = 胜率
   * q = 1 - p
   *
   * 使用 Half-Kelly (f-star / 2) 更保守，避免 overbetting。
   */
  private kellySizing(
    price: number,
    availableCapital: number,
    stopPrice?: number,
  ): PositionSizeResult {
    const history = this.tradeHistory;

    if (history.length < 10) {
      // 交易历史不足，降级为 fixed_pct
      log.info('[RiskEngine] Kelly: 历史不足10笔，降级为 fixed_pct');
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

    // 限制 Kelly 上限
    kellyFraction = Math.min(kellyFraction, this.config.kellyMaxFraction);
    kellyFraction = Math.max(kellyFraction, 0); // 不允许负值

    // Half-Kelly (更保守)
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
      reasoning: `Kelly f*=${(kellyFraction * 100).toFixed(1)}%, 胜率=${(winRate * 100).toFixed(1)}%, 赔率=${b.toFixed(2)}`,
    };
  }

  /**
   * ATR-based Sizing: qty = riskAmount / (ATR × multiplier)
   * riskAmount = totalAssets × atrRiskPerTrade (默认2%)
   */
  private atrSizing(
    price: number,
    availableCapital: number,
    atr?: number,
  ): PositionSizeResult {
    if (!atr || atr <= 0) {
      log.info('[RiskEngine] ATR sizing: ATR 不可用，降级为 fixed_pct');
      return this.fixedPctSizing(price, availableCapital);
    }

    const riskAmount = this.totalAssets * this.config.atrRiskPerTrade;
    const riskPerShare = atr * this.config.atrStopMultiplier;
    const qty = Math.floor(riskAmount / riskPerShare);

    // 不超过可用资金
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
      reasoning: `ATR=${atr.toFixed(2)}, 风险=$${riskAmount.toFixed(0)} (${(this.config.atrRiskPerTrade * 100).toFixed(1)}% 资产)`,
    };
  }

  /**
   * Fixed Percentage: 每次用 availableCapital 的 fixedPositionPct (默认10%)
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
      reasoning: `固定比例 ${(this.config.fixedPositionPct * 100).toFixed(0)}%, 可用资金=$${availableCapital.toFixed(0)}`,
    };
  }

  // ── v2: ATR 动态止损 ──────────────────────────────────────────

  /**
   * 计算 ATR-based 止损价
   * 止损价 = entryPrice - ATR × multiplier
   *
   * @param entryPrice  入场价
   * @param atr         当前 ATR
   * @param side        'LONG' | 'SHORT'
   * @returns           止损价
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
   * 更新追踪止损价。只在有利方向移动止损，从不回退。
   *
   * @param currentStop  当前止损价
   * @param currentPrice 当前价格
   * @param atr          当前 ATR
   * @param side         'LONG' | 'SHORT'
   * @returns            新的止损价
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
        log.info(`[RiskEngine] Trailing Stop 上移: ${currentStop.toFixed(2)} → ${newStop.toFixed(2)}`);
        return newStop;
      }
    } else {
      const newStop = currentPrice + offset;
      if (newStop < currentStop) {
        log.info(`[RiskEngine] Trailing Stop 下移: ${currentStop.toFixed(2)} → ${newStop.toFixed(2)}`);
        return newStop;
      }
    }

    return currentStop;
  }

  // ── v2: 滚动回撤监控 ──────────────────────────────────────────

  /**
   * 更新权益值并检查回撤状态。
   * 策略引擎在每次 onQuoteUpdate 时调用。
   *
   * @param currentEquity 当前总权益 (cash + position value)
   */
  updateEquity(currentEquity: number): void {
    const dd = this.drawdownState;

    // 更新峰值
    if (currentEquity > dd.peakEquity) {
      dd.peakEquity = currentEquity;
      dd.drawdownStart = undefined;
    }

    // 计算当前回撤
    if (dd.peakEquity > 0) {
      dd.currentDrawdownPct = (dd.peakEquity - currentEquity) / dd.peakEquity;
    }

    // 更新历史最大回撤
    if (dd.currentDrawdownPct > dd.maxDrawdownPct) {
      dd.maxDrawdownPct = dd.currentDrawdownPct;
      if (!dd.drawdownStart) dd.drawdownStart = Date.now();
    }

    // 检查是否需要降仓
    if (!dd.isReduced && dd.currentDrawdownPct >= this.config.drawdownReduceThreshold) {
      dd.isReduced = true;
      dd.reductionFactor = this.config.drawdownReduceFactor;
      this.addAlert(
        'DRAWDOWN_REDUCE',
        `回撤 ${(dd.currentDrawdownPct * 100).toFixed(1)}% 达到阈值，仓位降至 ${(dd.reductionFactor * 100).toFixed(0)}%`
      );
      log.warn(
        `[RiskEngine] 🔴 Drawdown ${(dd.currentDrawdownPct * 100).toFixed(1)}% → ` +
        `Position reduced to ${(dd.reductionFactor * 100).toFixed(0)}%`
      );
    }

    // 检查是否可以解除降仓
    if (dd.isReduced && dd.currentDrawdownPct < this.config.drawdownRecoveryThreshold) {
      dd.isReduced = false;
      dd.reductionFactor = 1.0;
      this.addAlert(
        'DRAWDOWN_RECOVERY',
        `回撤恢复至 ${(dd.currentDrawdownPct * 100).toFixed(1)}%，仓位限制解除`
      );
      log.info(`[RiskEngine] ✅ Drawdown recovered → Position limits removed`);
    }
  }

  /**
   * 获取当前回撤状态（供 UI 展示）
   */
  getDrawdownState(): DrawdownState {
    return { ...this.drawdownState };
  }

  // ── v2: 波动率调节 ──────────────────────────────────────────

  /**
   * 更新 VIX 值。由行情数据模块定期调用。
   */
  updateVix(vix: number): void {
    this.currentVix = vix;
  }

  /**
   * 根据 VIX 计算仓位调节因子。
   * VIX < 25 → factor = 1.0 (正常)
   * VIX 25-35 → factor = 0.5 (降半仓)
   * VIX > 35 → factor = 0.25 (降至1/4)
   */
  private computeVolFactor(): number {
    if (!this.config.volAdjustEnabled || this.currentVix === null) return 1.0;
    const vix = this.currentVix;
    if (vix >= this.config.vixExtremeThreshold) return 1 - this.config.vixExtremeReduction;
    if (vix >= this.config.vixHighThreshold) return 1 - this.config.vixHighReduction;
    return 1.0;
  }

  /**
   * 获取当前波动率调节因子（供 UI 展示）
   */
  getVolatilityFactor(): number {
    return this.computeVolFactor();
  }

  // ── v2: 交易历史管理（Kelly 计算用） ──────────────────────────

  /**
   * 记录交易结果。策略引擎在平仓时调用。
   */
  recordTrade(pnl: number): void {
    this.tradeHistory.push({ pnl, isWin: pnl > 0 });
    if (this.tradeHistory.length > this.MAX_TRADE_HISTORY) {
      this.tradeHistory.shift();
    }
  }

  /**
   * 获取 Kelly 统计摘要（供 UI 展示）
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

  // ── Clear / Reset ──────────────────────────────────────────────

  /**
   * Release all internal state and accumulated data.
   * Call between backtest runs or when the engine is no longer needed
   * to prevent memory leaks from accumulated arrays.
   */
  clear(): void {
    this.orderTimestamps = [];
    this.tradeHistory = [];
    this.alerts = [];
    this.dailyPnl = 0;
    this.dailyPnlDate = '';
    this.totalAssets = 0;
    this.currentVix = null;
    this.drawdownState = {
      peakEquity: 0,
      currentDrawdownPct: 0,
      maxDrawdownPct: 0,
      drawdownStart: undefined,
      isReduced: false,
      reductionFactor: 1.0,
    };
  }

  // ── State Updates (v1 保留) ──────────────────────────────────

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

  // ── v2: 完整状态快照（供 IPC 推送给 UI） ─────────────────────

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
