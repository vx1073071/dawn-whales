// ── Risk Engine — 风控引擎 v1 ──────────────────────────────────────────────
// 盘前检查 + 实时监控 + 紧急止损
// 每笔订单必须通过风控才能提交

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
};

export class RiskEngine {
  private config: RiskConfig = { ...DEFAULT_CONFIG };
  private orderTimestamps: number[] = [];
  private dailyPnl = 0;
  private dailyPnlDate = '';
  private totalAssets = 0;
  private alerts: { time: number; type: string; message: string }[] = [];

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
}
