// ── Risk Engine — 风控引擎 v2 ──────────────────────────────────────────────
// 盘前检查 + 实时监控 + 紧急止损
// 每笔订单必须通过风控才能提交
// Phase 3: ATR动态止损 + 滚动回撤Caps + 波动率调节

import log from 'electron-log';

interface RiskCheckResult {
  pass: boolean;
  reason?: string;
  warnings?: string[];
}

interface RiskConfig {
  maxSinglePositionPct: number;  // 单品种最大占比 (20%)
  maxTotalPositionPct: number;   // 总持仓最大占比 (95%)
  dailyLossLimitPct: number;     // 日最大亏损 (5%)
  maxOrdersPerMinute: number;    // 频率限制 (10)
  maxOrderQty: number;           // 单笔最大数量
  minOrderQty: number;           // 单笔最小数量 (1)
  maxOrderValue: number;         // 单笔最大金额 (USD)
  tradingHoursOnly: boolean;     // 仅交易时段
  blacklist: string[];           // 禁止交易的标的
  // Phase 3 新增
  useATRStopLoss: boolean;       // 启用 ATR 动态止损
  atrPeriod: number;             // ATR 周期 (默认14)
  atrMultiplier: number;         // ATR 倍数 (默认2)
  maxRollingDrawdownPct: number; // 滚动回撤上限 (默认15%)
  rollingDrawdownWindow: number; // 滚动窗口天数 (默认20)
  useVolatilityAdjustment: boolean; // 启用波动率调节
  vixHighThreshold: number;      // VIX 高位阈值 (默认25)
  vixLowThreshold: number;       // VIX 低位阈值 (默认12)
}

const DEFAULT_CONFIG: RiskConfig = {
  maxSinglePositionPct: 0.20,
  maxTotalPositionPct: 0.95,
  dailyLossLimitPct: 0.05,
  maxOrdersPerMinute: 10,
  maxOrderQty: 10000,
  minOrderQty: 1,
  maxOrderValue: 50000,
  tradingHoursOnly: true,
  blacklist: [],
  // Phase 3 默认值
  useATRStopLoss: true,
  atrPeriod: 14,
  atrMultiplier: 2,
  maxRollingDrawdownPct: 0.15,
  rollingDrawdownWindow: 20,
  useVolatilityAdjustment: true,
  vixHighThreshold: 25,
  vixLowThreshold: 12,
};

export class RiskEngine {
  private config: RiskConfig = { ...DEFAULT_CONFIG };
  private orderTimestamps: number[] = [];
  private dailyPnl = 0;
  private dailyPnlDate = '';
  private totalAssets = 0;
  private alerts: { time: number; type: string; message: string }[] = [];

  // Phase 3: ATR 动态止损状态
  private atrValues: Map<string, number[]> = new Map(); // symbol -> recent ATR values
  private entryPrices: Map<string, number> = new Map();   // symbol -> 持仓入场价

  // Phase 3: 滚动回撤状态
  private peakValues: Map<string, number> = new Map();     // symbol -> 历史最高值
  private rollingWindowPrices: Map<string, number[]> = new Map(); // symbol -> 窗口内价格序列

  // Phase 3: 波动率状态
  private currentVIX = 18; // 默认值，实际由外部更新

  // ── Order Check (called before every order) ─────────────────────

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

    // 3. Order value check (with volatility adjustment)
    let orderValue = (order.price || 0) * order.qty;
    if (this.config.useVolatilityAdjustment && this.currentVIX > this.config.vixHighThreshold) {
      // VIX 高位时，仓位上限临时降低 50%
      const vixAdjustment = 0.5;
      orderValue = orderValue / vixAdjustment;
      warnings.push(`⚠️ VIX ${this.currentVIX.toFixed(1)} 处于高位，仓位上限临时下调 50%`);
    }
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

    // 6. Position concentration check (with volatility adjustment)
    if (this.totalAssets > 0 && orderValue > 0) {
      let effectiveMaxPosition = this.config.maxSinglePositionPct;
      if (this.config.useVolatilityAdjustment) {
        if (this.currentVIX > this.config.vixHighThreshold) {
          effectiveMaxPosition *= 0.5; // 高波动时单品种上限减半
        } else if (this.currentVIX < this.config.vixLowThreshold) {
          effectiveMaxPosition *= 1.2; // 低波动时可适当放大
        }
      }
      const positionPct = orderValue / this.totalAssets;
      if (positionPct > effectiveMaxPosition) {
        return { pass: false, reason: `单品种占比 ${(positionPct * 100).toFixed(1)}% 超过动态上限 ${(effectiveMaxPosition * 100).toFixed(1)}%` };
      }
      if (positionPct > effectiveMaxPosition * 0.8) {
        warnings.push(`⚠️ 单品种占比 ${(positionPct * 100).toFixed(1)}%，接近动态上限`);
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

    this.orderTimestamps.push(now);
    return { pass: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  // ── State Updates ───────────────────────────────────────────────

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

  // ── Phase 3: ATR Dynamic Stop Loss ─────────────────────────────────────────
  // ATR 动态止损 = 入场价 - N × ATR
  // 用于追踪当前持仓的浮动止损

  /**
   * 更新 ATR 值（由外部行情数据喂入）
   * @param symbol 标的代码
   * @param atr ATR 值（真实波动幅度）
   */
  updateATR(symbol: string, atr: number): void {
    if (!this.atrValues.has(symbol)) {
      this.atrValues.set(symbol, []);
    }
    const history = this.atrValues.get(symbol)!;
    history.push(atr);
    // 保留最近 atrPeriod * 2 个值
    if (history.length > this.config.atrPeriod * 2) {
      history.shift();
    }
    log.info(`[RiskEngine] ATR ${symbol}: ${atr.toFixed(4)}, avg=${this.getAverageATR(symbol).toFixed(4)}`);
  }

  /**
   * 设置持仓入场价
   */
  setEntryPrice(symbol: string, price: number): void {
    this.entryPrices.set(symbol, price);
    // 同步更新峰值
    const peak = this.peakValues.get(symbol) || price;
    this.peakValues.set(symbol, Math.max(peak, price));
    log.info(`[RiskEngine] Entry price set for ${symbol}: ${price}`);
  }

  /**
   * 获取标的的平均 ATR
   */
  getAverageATR(symbol: string): number {
    const history = this.atrValues.get(symbol);
    if (!history || history.length === 0) return 0;
    const period = Math.min(history.length, this.config.atrPeriod);
    const recent = history.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  /**
   * 计算 ATR 动态止损价（多头持仓）
   * 止损价 = 当前价 - multiplier × ATR
   */
  getATRStopLossPrice(symbol: string, currentPrice: number): number | null {
    if (!this.config.useATRStopLoss) return null;
    const avgATR = this.getAverageATR(symbol);
    if (avgATR <= 0) return null;
    const stopPrice = currentPrice - this.config.atrMultiplier * avgATR;
    return stopPrice;
  }

  /**
   * Phase 3: 检查 ATR 止损触发
   * 返回需要触发的标的列表
   */
  checkATRStopLoss(currentPrices: Map<string, number>): string[] {
    const triggered: string[] = [];
    for (const [symbol, entryPrice] of this.entryPrices.entries()) {
      const currentPrice = currentPrices.get(symbol);
      if (currentPrice === undefined) continue;
      const stopPrice = this.getATRStopLossPrice(symbol, currentPrice);
      if (stopPrice !== null && currentPrice <= stopPrice) {
        this.addAlert('ATR_STOP_LOSS', `${symbol} ATR止损触发: 当前价 ${currentPrice.toFixed(2)} <= 止损价 ${stopPrice.toFixed(2)}`);
        triggered.push(symbol);
      }
    }
    return triggered;
  }

  // ── Phase 3: Rolling Drawdown Caps ─────────────────────────────────────────
  // 滚动窗口内从峰值回撤超过 maxRollingDrawdownPct 时，拒绝新开仓

  /**
   * 更新价格序列（每次行情更新时调用）
   */
  updatePrice(symbol: string, price: number): void {
    // 更新峰值
    const currentPeak = this.peakValues.get(symbol) || price;
    this.peakValues.set(symbol, Math.max(currentPeak, price));

    // 更新滚动窗口
    if (!this.rollingWindowPrices.has(symbol)) {
      this.rollingWindowPrices.set(symbol, []);
    }
    const window = this.rollingWindowPrices.get(symbol)!;
    window.push(price);
    if (window.length > this.config.rollingDrawdownWindow) {
      window.shift();
    }
  }

  /**
   * 获取标的当前回撤（从峰值）
   */
  getCurrentDrawdown(symbol: string, currentPrice: number): number {
    const peak = this.peakValues.get(symbol);
    if (!peak || peak === 0) return 0;
    return (peak - currentPrice) / peak;
  }

  /**
   * Phase 3: 检查滚动回撤是否超限
   */
  checkRollingDrawdown(symbol: string, currentPrice: number): { pass: boolean; drawdownPct: number } {
    const drawdown = this.getCurrentDrawdown(symbol, currentPrice);
    const drawdownPct = drawdown * 100;
    if (drawdownPct >= this.config.maxRollingDrawdownPct * 100) {
      this.addAlert('ROLLING_DRAWDOWN', `${symbol} 滚动回撤 ${drawdownPct.toFixed(1)}% 超过上限 ${this.config.maxRollingDrawdownPct * 100}%`);
      return { pass: false, drawdownPct };
    }
    if (drawdownPct >= this.config.maxRollingDrawdownPct * 100 * 0.8) {
      this.addAlert('ROLLING_DRAWDOWN_WARN', `${symbol} 滚动回撤 ${drawdownPct.toFixed(1)}%，接近上限`);
    }
    return { pass: true, drawdownPct };
  }

  // ── Phase 3: Volatility Adjustment ─────────────────────────────────────────
  // VIX 高位时自动降低仓位，低位时可适当放大

  /**
   * 更新当前 VIX 值（由行情数据定时喂入）
   */
  updateVIX(vix: number): void {
    this.currentVIX = vix;
    if (vix > this.config.vixHighThreshold) {
      this.addAlert('VIX_HIGH', `VIX ${vix.toFixed(1)} 处于高位（>${this.config.vixHighThreshold}），自动降低仓位上限 50%`);
    }
  }

  /**
   * 获取当前波动率调节系数
   */
  getVolatilityFactor(): number {
    if (!this.config.useVolatilityAdjustment) return 1.0;
    if (this.currentVIX > this.config.vixHighThreshold) return 0.5;
    if (this.currentVIX < this.config.vixLowThreshold) return 1.2;
    return 1.0;
  }

  /**
   * 获取风控状态摘要（供 UI 展示）
   */
  getRiskStatus(): Record<string, any> {
    return {
      vix: this.currentVIX,
      volatilityFactor: this.getVolatilityFactor(),
      atrStopLossEnabled: this.config.useATRStopLoss,
      atrMultiplier: this.config.atrMultiplier,
      rollingDrawdownCap: this.config.maxRollingDrawdownPct * 100,
      rollingDrawdownWindow: this.config.rollingDrawdownWindow,
      entries: Array.from(this.entryPrices.entries()).map(([sym, price]) => ({
        symbol: sym,
        entryPrice: price,
        currentATR: this.getAverageATR(sym),
        peak: this.peakValues.get(sym) || price,
        drawdown: this.getCurrentDrawdown(sym, price) * 100,
      })),
    };
  }
}
