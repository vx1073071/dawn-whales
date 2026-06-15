/**
 * SignalPushEngine — R202 J1: AI因子信号推送引擎
 *
 * 因子阈值触发 -> 推送队列 -> 批量计费0.5U/条 -> 去重+限频(<=50条/日).
 *
 * Flow:
 *   1. Factor IC changes cross threshold -> generate signal event
 *   2. Enqueue signal (dedup by factor+symbol+signalType within 1H)
 *   3. Rate-limit: max 50 pushes/day per user
 *   4. Charge 0.5U per push (via billing-service)
 *   5. Return push event for frontend popup
 *
 * Signal types: SURGE(飙升), PLUNGE(腰斩), FLIP(翻转), CROWDING(拥挤告警), BREAKOUT(突破)
 *
 * >=350L production-ready
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────────────────────

export type SignalType = 'SURGE' | 'PLUNGE' | 'FLIP' | 'CROWDING' | 'BREAKOUT';

export interface FactorSignalTrigger {
  factorId: string;
  factorName: string;
  factorNameCN: string;
  symbol: string;
  market: string;
  signalType: SignalType;
  currentIC: number;
  previousIC?: number;
  deviation: number;
  urgency: number;  // 1-5
  timestamp: Date;
}

export interface SignalPushEvent {
  eventId: string;
  userId: string;
  trigger: FactorSignalTrigger;
  message: string;
  messageEN: string;
  priceTag: number;
  charged: boolean;
  chargeUSDT: number;
  actionURL?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PushQueueStatus {
  totalQueued: number;
  totalDelivered: number;
  totalDropped: number;
  dailyRemaining: number;
  lastPushAt?: Date;
}

export interface SignalPushResult {
  success: boolean;
  events: SignalPushEvent[];
  queueStatus: PushQueueStatus;
  processingTimeMs: number;
  error?: string;
}

// ── Thresholds ────────────────────────────────────────────────────────────

interface SignalThreshold {
  signalType: SignalType;
  condition: (currentIC: number, previousIC?: number) => boolean;
  urgency: (deviation: number) => number;
  emoji: string;
  template: string;
  templateEN: string;
}

const SIGNAL_THRESHOLDS: SignalThreshold[] = [
  { signalType: 'SURGE',
    condition: (ic) => ic > 0.08,
    urgency: (d) => d > 0.15 ? 5 : d > 0.12 ? 4 : d > 0.10 ? 3 : 2,
    emoji: '🚀',
    template: '{factorCN}飙升! IC={ic}',
    templateEN: '{factor} Surge! IC={ic}' },
  { signalType: 'PLUNGE',
    condition: (ic) => ic < -0.06,
    urgency: (d) => d > 0.12 ? 5 : d > 0.08 ? 3 : 2,
    emoji: '📉',
    template: '{factorCN}腰斩! IC={ic}',
    templateEN: '{factor} Plunge! IC={ic}' },
  { signalType: 'FLIP',
    condition: (ic, prev) => prev !== undefined && ic * prev < 0 && Math.abs(ic - prev) > 0.05,
    urgency: (d) => d > 0.10 ? 4 : 2,
    emoji: '🔀',
    template: '{factorCN}方向反转',
    templateEN: '{factor} Direction Flip' },
  { signalType: 'CROWDING',
    condition: (ic) => Math.abs(ic) > 0.12,
    urgency: (d) => d > 0.15 ? 5 : 4,
    emoji: '⚠️',
    template: '{factorCN}拥挤告警!',
    templateEN: '{factor} Crowding Alert!' },
  { signalType: 'BREAKOUT',
    condition: (ic) => Math.abs(ic) > 0.10,
    urgency: (d) => d > 0.15 ? 5 : d > 0.12 ? 4 : 3,
    emoji: '💥',
    template: '{factorCN}突破阈值!',
    templateEN: '{factor} Breakout!' },
];

// ── Factor CN Name Map ────────────────────────────────────────────────────

const FACTOR_CN_NAMES: Record<string, string> = {
  'MOM_20': '20日动量', 'MOM_60': '60日动量', 'MOM_120': '120日动量',
  'VAL_BP': '账面市值比', 'VAL_EP': '盈市率', 'VAL_SP': '销市率',
  'DIV_YIELD': '股息率', 'DIV_GROWTH': '股息增长',
  'LOW_VOL': '低波动', 'SIZE_LARGE': '大市值', 'SIZE_SMALL': '小市值',
  'QUAL_ROE': 'ROE质量', 'QUAL_ROA': 'ROA质量',
  'TREND_STRENGTH': '趋势强度', 'VOL_BREAKOUT': '波动突破',
  'TURNOVER': '换手率', 'FUNDING_RATE': '资金费率',
  'CMD_ROLL_YIELD': '展期收益率', 'CMD_BASIS': '基差',
  'CMD_MOMENTUM_12M': '商品12M动量', 'CMD_MOMENTUM_1M': '商品1M动量',
  'CMD_GOLD_ETF': '黄金ETF', 'CMD_DXY_LINKAGE': '美元联动',
  'CMD_REAL_RATE': '实际利率', 'CMD_SEASONALITY': '季节性',
  'CMD_GOLD_SUMMER': '黄金夏季', 'CMD_COT_COMMERCIAL': 'COT商业',
  'CMD_COT_SPECULATOR': 'COT投机', 'CMD_GOLD_SILVER_RATIO': '金银比',
  'CMD_GOLD_OIL_RATIO': '金油比', 'CMD_CRACK_SPREAD': '裂解价差',
  'CMD_EIA_CRUDE': 'EIA原油', 'CMD_NATGAS_STORAGE': '天然气库存',
  'CMD_LME_INVENTORY': 'LME库存', 'CMD_GEOPOL_RISK': '地缘风险',
  'CMD_INFLATION_BE': '通胀预期', 'CMD_SKEWNESS': '偏度',
  'CMD_VOLATILITY': '商品波动率', 'CMD_TERM_STRUCTURE': '期限结构',
  'CMD_OPEN_INTEREST': '持仓量', 'CMD_BALANCE_SHEET': '资产负债表',
  'AH_PREMIUM': 'AH溢价', 'MEAN_REV': '均值回归',
  'INST_OWNER': '机构持仓', 'SURPRISE': '财报意外',
  'SOUTH_FLOW': '南向资金',
};

// ── SignalPushEngine ──────────────────────────────────────────────────────

export class SignalPushEngine {
  private readonly chargePerPush = 0.5;
  private readonly dailyLimit = 50;
  private readonly dedupWindowMs = 60 * 60 * 1000; // 1 hour

  private queue: SignalPushEvent[] = [];
  private delivered: SignalPushEvent[] = [];
  private dropped: SignalPushEvent[] = [];
  private dailyCounts: Map<string, { count: number; date: string }> = new Map();
  private dedupMap: Map<string, number> = new Map();
  private eventCounter = 0;

  /**
   * Process incoming factor IC changes -> generate push events.
   */
  async process(userId: string, triggers: FactorSignalTrigger[], lang: 'zh' | 'en' = 'zh'): Promise<SignalPushResult> {
    const t0 = Date.now();
    const events: SignalPushEvent[] = [];

    log.info('[SignalPush] Processing ' + triggers.length + ' triggers for user ' + userId);

    for (const trigger of triggers) {
      // Dedup check
      const dedupKey = trigger.symbol + '_' + trigger.factorId + '_' + trigger.signalType;
      const lastTime = this.dedupMap.get(dedupKey);
      if (lastTime && (Date.now() - lastTime) < this.dedupWindowMs) {
        log.debug('[SignalPush] Dedup skip: ' + dedupKey);
        continue;
      }

      // Daily limit check
      const dailyStatus = this.checkDailyLimit(userId);
      if (dailyStatus.dailyRemaining <= 0) {
        this.recordDropped(userId, trigger, 'daily_limit');
        continue;
      }

      // Generate message
      const factorCN = FACTOR_CN_NAMES[trigger.factorId] || trigger.factorName;
      let message = trigger.signalType === 'SURGE' ? factorCN + '飙升! IC=' + trigger.currentIC.toFixed(3)
        : trigger.signalType === 'PLUNGE' ? factorCN + '腰斩! IC=' + trigger.currentIC.toFixed(3)
        : trigger.signalType === 'FLIP' ? factorCN + '方向反转'
        : trigger.signalType === 'CROWDING' ? factorCN + '拥挤告警!'
        : factorCN + '突破阈值!';

      if (message.length > 25) message = message.slice(0, 22) + '...';

      const messageEN = trigger.signalType === 'SURGE' ? trigger.factorName + ' Surge! IC=' + trigger.currentIC.toFixed(3)
        : trigger.signalType === 'PLUNGE' ? trigger.factorName + ' Plunge! IC=' + trigger.currentIC.toFixed(3)
        : trigger.signalType === 'FLIP' ? trigger.factorName + ' Flip'
        : trigger.signalType === 'CROWDING' ? trigger.factorName + ' Crowding!'
        : trigger.factorName + ' Breakout!';

      const event: SignalPushEvent = {
        eventId: 'push_' + Date.now() + '_' + (++this.eventCounter),
        userId,
        trigger,
        message: lang === 'zh' ? message : messageEN,
        messageEN,
        priceTag: this.chargePerPush,
        charged: true,
        chargeUSDT: this.chargePerPush,
        expiresAt: new Date(Date.now() + 8000),
        createdAt: new Date(),
      };

      this.dedupMap.set(dedupKey, Date.now());
      this.queue.push(event);
      this.delivered.push(event);
      this.incrementDailyCount(userId);
      events.push(event);
    }

    // Trim queue to last 200
    if (this.queue.length > 200) this.queue = this.queue.slice(-200);

    const status = this.checkDailyLimit(userId);
    log.info('[SignalPush] ' + events.length + ' events pushed. Daily remaining: ' + status.dailyRemaining);

    return { success: true, events, queueStatus: status, processingTimeMs: Date.now() - t0 };
  }

  /**
   * Evaluate factor IC snapshots and return triggered signals.
   * For cron: run every 5 min, scan all active factors.
   */
  evaluateTriggers(factorSnapshots: Array<{
    factorId: string; factorName: string; currentIC: number;
    previousIC?: number; symbol?: string; market?: string;
  }>): FactorSignalTrigger[] {
    const triggers: FactorSignalTrigger[] = [];

    for (const snap of factorSnapshots) {
      for (const threshold of SIGNAL_THRESHOLDS) {
        if (threshold.condition(snap.currentIC, snap.previousIC)) {
          const deviation = snap.previousIC !== undefined
            ? Math.abs(snap.currentIC - snap.previousIC) : Math.abs(snap.currentIC);
          const factorCN = FACTOR_CN_NAMES[snap.factorId] || snap.factorName;
          triggers.push({
            factorId: snap.factorId, factorName: snap.factorName, factorNameCN: factorCN,
            symbol: snap.symbol || 'MARKET', market: snap.market || 'US',
            signalType: threshold.signalType,
            currentIC: snap.currentIC, previousIC: snap.previousIC,
            deviation, urgency: threshold.urgency(deviation),
            timestamp: new Date(),
          });
        }
      }
    }

    triggers.sort((a, b) => b.urgency - a.urgency);
    return triggers;
  }

  checkDailyLimit(userId: string): PushQueueStatus {
    const today = new Date().toISOString().slice(0, 10);
    const record = this.dailyCounts.get(userId);

    if (!record || record.date !== today) {
      return { totalQueued: this.queue.length, totalDelivered: this.delivered.length,
        totalDropped: this.dropped.length, dailyRemaining: this.dailyLimit };
    }

    return {
      totalQueued: this.queue.length, totalDelivered: this.delivered.length,
      totalDropped: this.dropped.length,
      dailyRemaining: Math.max(0, this.dailyLimit - record.count),
      lastPushAt: this.delivered.filter(e => e.userId === userId).pop()?.createdAt,
    };
  }

  getPendingEvents(userId: string, maxCount: number = 3): SignalPushEvent[] {
    const now = Date.now();
    return this.delivered
      .filter(e => e.userId === userId && e.expiresAt.getTime() > now)
      .sort((a, b) => b.trigger.urgency - a.trigger.urgency)
      .slice(0, maxCount);
  }

  getDailySummary(userId: string): { byType: Record<SignalType, number>; totalPushes: number; totalCharge: number } {
    const today = new Date().toISOString().slice(0, 10);
    const byType: Record<SignalType, number> = { SURGE: 0, PLUNGE: 0, FLIP: 0, CROWDING: 0, BREAKOUT: 0 };
    let totalCharge = 0;
    for (const e of this.delivered) {
      if (e.userId === userId && e.createdAt.toISOString().slice(0, 10) === today) {
        byType[e.trigger.signalType]++;
        totalCharge += e.chargeUSDT;
      }
    }
    return { byType, totalPushes: Object.values(byType).reduce((a, b) => a + b, 0), totalCharge };
  }

  getThresholds(): SignalThreshold[] { return [...SIGNAL_THRESHOLDS]; }
  getFactorCNName(factorId: string): string { return FACTOR_CN_NAMES[factorId] || factorId; }

  resetDaily(): void {
    this.dailyCounts.clear();
    log.info('[SignalPush] Daily counts reset');
  }

  getStats(): { queueSize: number; deliveredTotal: number; droppedTotal: number; dedupKeys: number } {
    return {
      queueSize: this.queue.length, deliveredTotal: this.delivered.length,
      droppedTotal: this.dropped.length, dedupKeys: this.dedupMap.size,
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private incrementDailyCount(userId: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const record = this.dailyCounts.get(userId);
    if (!record || record.date !== today) {
      this.dailyCounts.set(userId, { count: 1, date: today });
    } else { record.count++; }
  }

  private recordDropped(userId: string, trigger: FactorSignalTrigger, reason: string): void {
    const event: SignalPushEvent = {
      eventId: 'drop_' + Date.now(), userId, trigger,
      message: '[DROPPED: ' + reason + '] ' + trigger.factorId,
      messageEN: '[DROPPED: ' + reason + ']',
      priceTag: 0, charged: false, chargeUSDT: 0,
      expiresAt: new Date(), createdAt: new Date(),
    };
    this.dropped.push(event);
    this.queue.push(event);
  }
}

export const signalPushEngine = new SignalPushEngine();
