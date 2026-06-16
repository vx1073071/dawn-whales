/**
 * R253 AI-01: AIQuickReviewTriggers — AI快评触发规则引擎
 * LOBEHUB | v3.0.0 QUANT MOO
 *
 * 定义AI自动生成简短市场评论的触发条件+频率控制。
 * 5种市场状态自动检测 → 触发对应AI快评。
 *
 * 触发类型:
 *   1. 开盘快评 — 盘前3分钟自动
 *   2. 异动快评 — 单只股票波动>5%自动
 *   3. 板块轮动 — 3+只同板块同时>3%
 *   4. 量能异常 — 成交量>20日均量2倍
 *   5. 关键点位 — 触及支撑/阻力/整数关口
 *
 * 频率控制: 避免过度打扰用户
 * >=400L
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────

export type TriggerType = 'open_brief' | 'anomaly_alert' | 'sector_rotation' | 'volume_spike' | 'key_level';

export interface TriggerRule {
  type: TriggerType;
  name: string;
  condition: string;             // 人类可读条件
  checkFn: (context: MarketContext) => boolean;
  cooldownMs: number;            // 两次触发最小间隔
  priority: 'critical' | 'high' | 'medium' | 'low';
  maxPerDay: number;             // 每日最多触发次数
  requireConfirmation: boolean;  // 是否需要人工确认
}

export interface MarketContext {
  market: string; symbol?: string; sector?: string;
  price: number; prevClose: number; change: number; changePct: number;
  volume: number; avgVolume20d: number;
  isMarketOpen: boolean; minutesToOpen: number;
  sectorStocks?: { symbol: string; changePct: number; }[];
  touchedLevels?: { level: number; type: 'support' | 'resistance' | 'round'; }[];
}

export interface AIQuickReview {
  id: string;
  type: TriggerType;
  triggeredAt: number;
  context: MarketContext;
  reviewText: string;           // AI生成的快评
  marketState: string;          // 市场状态标签
  confidence: number;           // AI信心度
  action: string;               // 建议: 观察/减仓/加仓/观望
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// ── AIQuickReviewTriggers ─────────────────────────────────

export class AIQuickReviewTriggers {
  readonly id = 'ai_quick_review_triggers';
  readonly version = '3.0.0';

  private lastTriggered: Map<TriggerType, number> = new Map();
  private dailyCounts: Map<TriggerType, number> = new Map();
  private dailyCounterReset = Date.now();

  readonly rules: TriggerRule[] = [
    {
      type: 'open_brief',
      name: '开盘快评',
      condition: '盘前3分钟且市场即将开盘',
      checkFn: (ctx) => !ctx.isMarketOpen && ctx.minutesToOpen <= 3 && ctx.minutesToOpen >= 0,
      cooldownMs: 84000000,  // 23h20min (每个交易日一次)
      priority: 'high',
      maxPerDay: 1,
      requireConfirmation: false,
    },
    {
      type: 'anomaly_alert',
      name: '异动快评',
      condition: '单只股票波动>5%',
      checkFn: (ctx) => ctx.symbol !== undefined && Math.abs(ctx.changePct) > 5,
      cooldownMs: 300000,  // 5min (同股票)
      priority: 'critical',
      maxPerDay: 20,
      requireConfirmation: false,
    },
    {
      type: 'sector_rotation',
      name: '板块轮动',
      condition: '3+只同板块股票同时>3%',
      checkFn: (ctx) => (ctx.sectorStocks?.filter(s => Math.abs(s.changePct) > 3).length ?? 0) >= 3,
      cooldownMs: 900000,  // 15min (同板块)
      priority: 'high',
      maxPerDay: 10,
      requireConfirmation: false,
    },
    {
      type: 'volume_spike',
      name: '量能异常',
      condition: '成交量>20日均量2倍',
      checkFn: (ctx) => ctx.avgVolume20d > 0 && ctx.volume / ctx.avgVolume20d > 2,
      cooldownMs: 600000,  // 10min
      priority: 'medium',
      maxPerDay: 15,
      requireConfirmation: false,
    },
    {
      type: 'key_level',
      name: '关键点位',
      condition: '触及支撑/阻力/整数关口',
      checkFn: (ctx) => (ctx.touchedLevels?.length ?? 0) > 0,
      cooldownMs: 1800000, // 30min
      priority: 'medium',
      maxPerDay: 8,
      requireConfirmation: true,
    },
  ];

  /** 检测并返回触发的规则 */
  checkTriggers(context: MarketContext): TriggerRule[] {
    this.resetDailyIfNeeded();
    const triggered: TriggerRule[] = [];

    for (const rule of this.rules) {
      // 每日限制
      const dailyCount = this.dailyCounts.get(rule.type) || 0;
      if (dailyCount >= rule.maxPerDay) continue;

      // 冷却期
      const lastTime = this.lastTriggered.get(rule.type) || 0;
      if (Date.now() - lastTime < rule.cooldownMs) continue;

      // 条件判断
      if (rule.checkFn(context)) {
        triggered.push(rule);
        this.lastTriggered.set(rule.type, Date.now());
        this.dailyCounts.set(rule.type, dailyCount + 1);
      }
    }

    if (triggered.length > 0) {
      log.info(`[AIReview] ${triggered.length} triggers fired: ${triggered.map(t => t.type).join(', ')}`);
    }

    return triggered;
  }

  /** 获取可用的已触发规则列表（用于UI展示） */
  getActiveTriggers(context: MarketContext): TriggerRule[] {
    return this.rules.filter(r => r.checkFn(context));
  }

  /** 手动触发一条规则（跳过冷却和每日限制） */
  forceTrigger(type: TriggerType, context: MarketContext): TriggerRule | null {
    const rule = this.rules.find(r => r.type === type);
    if (!rule) return null;
    this.lastTriggered.set(type, Date.now());
    return rule;
  }

  /** 获取状态 */
  getStatus(): { rule: string; lastTriggered: string; dailyCount: number; maxPerDay: number; cooldownActive: boolean; }[] {
    return this.rules.map(r => {
      const last = this.lastTriggered.get(r.type) || 0;
      return {
        rule: r.name,
        lastTriggered: last > 0 ? new Date(last).toISOString() : 'never',
        dailyCount: this.dailyCounts.get(r.type) || 0,
        maxPerDay: r.maxPerDay,
        cooldownActive: Date.now() - last < r.cooldownMs,
      };
    });
  }

  /** 重置每日计数 */
  private resetDailyIfNeeded(): void {
    const now = Date.now();
    if (now - this.dailyCounterReset > 86400000) {
      this.dailyCounts.clear();
      this.dailyCounterReset = now;
      log.info('[AIReview] Daily trigger counts reset');
    }
  }
}

export default AIQuickReviewTriggers;
