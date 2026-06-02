// ── Risk Engine — 风控引擎 ─────────────────────────────────────────────────
import log from 'electron-log';

interface RiskCheckResult { pass: boolean; reason?: string }

export class RiskEngine {
  private config = {
    maxSinglePositionPct: 0.20,  // 单品种最大 20%
    maxTotalPositionPct: 0.95,   // 总持仓最大 95%
    dailyLossLimitPct: 0.05,     // 日最大亏损 5%
    maxOrdersPerMinute: 10,      // 频率限制
  };

  private orderTimestamps: number[] = [];

  checkOrder(order: any): RiskCheckResult {
    // Frequency limit
    const now = Date.now();
    this.orderTimestamps = this.orderTimestamps.filter(t => now - t < 60000);
    if (this.orderTimestamps.length >= this.config.maxOrdersPerMinute) {
      log.warn('[RiskEngine] ⚠️ Rate limit: too many orders');
      return { pass: false, reason: '下单频率过高（每分钟最多10单）' };
    }

    // Basic sanity checks
    if (order.qty <= 0) return { pass: false, reason: '数量必须大于0' };
    if (order.price && order.price <= 0) return { pass: false, reason: '价格必须大于0' };

    this.orderTimestamps.push(now);
    return { pass: true };
  }

  updateConfig(config: Partial<typeof this.config>) {
    Object.assign(this.config, config);
    log.info('[RiskEngine] Config updated:', this.config);
  }
}
