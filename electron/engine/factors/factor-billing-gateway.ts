// ── R174 D1: Unified Factor Billing Gateway ──────────────────────────────────
// 23 payment touchpoints, unified hold→settle→refund billing flow.
//
// Touchpoints:
//   1. AI_RECOMMENDATION —— AI因子推荐 (ai-factor-advisor)
//   2. BACKTEST_REPORT   —— 回测报告 (backtest-engine)
//   3. SIGNAL_SUBSCRIBE  —— 信号订阅 (factor-signal-pipeline)
//   4. STRATEGY_MARKET   —— 策略市场 (marketplace)
//   5. PAPER_TRADING     —— 模拟交易 (paper trading)
//   6. PORTFOLIO_DIAGNOSIS —— 组合诊断 (portfolio diagnosis)
//   7. COMPARISON_ANALYSIS —— 对比分析 (comparison)
//   8. WEIGHT_OPTIMIZER  —— 权重优化 (optimizer)
//   9. SNAPSHOT_RESTORE  —— 快照恢复 (snapshot)
//  10. DEEP_RESEARCH     —— 深度研究 (deep research)
//  11. FACTOR_EXPERIMENT —— 因子实验 (factor experiment)
//  12. FACTOR_MULTI_BACKTEST —— 多因子组合回测 (v17.7, 1U/次, 🟡进阶+)
//  13. FACTOR_DEEP_DIAGNOSIS —— 因子深度诊断 (v17.7, 1U/次, 🟡进阶+)
//  14. FACTOR_PARAM_OPTIMIZE —— AI因子参数优化 (v17.7, 1.5U/次, 🔴专业)
//  15. FACTOR_ALT_DATA_UNLOCK —— 替代数据因子解锁 (v17.7, 2U/次, 🔴专业)
//  16. AI_STRATEGY_MATCH —— AI策略匹配推荐 (v17.8, 1U/次)
//  17. AI_MARKET_STATE   —— AI市场状态识别 (v17.8, 1U/次)
//  18. AI_DAILY_BRIEFING —— AI每日因子简报 (v17.8, 1U/次)
//  19. AI_ARBITRAGE_SCAN —— AI跨市场套利扫描 (v17.8, 2U/次)
//  20. AI_FACTOR_SIGNAL_PUSH —— AI因子信号推送 (v17.8, 0.5U/次)
//  21. AI_STRESS_TEST    —— AI策略压力测试 (v17.8, 2U/次)
//  22. AI_PORTFOLIO_ATTRIBUTION —— AI持仓归因分析 (v17.8, 1.5U/次)
//  23. AI_CREATOR_REVIEW —— AI创作者策略审核 (v17.9, 1U/次, 不退费, 无申诉, 每次审核1U)
//
// Each point: hold → compute → settle on success → refund on failure.
// Free tier: factor name/result/signal/basic IC = always free.
// Deep services: pay-per-use for compute-heavy features.
//
// Reference: ai-usage-billing-contract.ts hold/settle/refund pattern

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ───────────────────────────────────────────────────────────────────

/** Payment touchpoint identifiers */
export type BillingTouchpoint =
  | 'AI_RECOMMENDATION'
  | 'BACKTEST_REPORT'
  | 'SIGNAL_SUBSCRIBE'
  | 'STRATEGY_MARKET'
  | 'PAPER_TRADING'
  | 'PORTFOLIO_DIAGNOSIS'
  | 'COMPARISON_ANALYSIS'
  | 'WEIGHT_OPTIMIZER'
  | 'SNAPSHOT_RESTORE'
  | 'DEEP_RESEARCH'
  | 'FACTOR_EXPERIMENT'
  | 'FACTOR_MULTI_BACKTEST'
  | 'FACTOR_DEEP_DIAGNOSIS'
  | 'FACTOR_PARAM_OPTIMIZE'
  | 'FACTOR_ALT_DATA_UNLOCK'
  | 'AI_STRATEGY_MATCH'
  | 'AI_MARKET_STATE'
  | 'AI_DAILY_BRIEFING'
  | 'AI_ARBITRAGE_SCAN'
  | 'AI_FACTOR_SIGNAL_PUSH'
  | 'AI_STRESS_TEST'
  | 'AI_PORTFOLIO_ATTRIBUTION'
  | 'AI_CREATOR_REVIEW';

/** Billing status for a single touchpoint usage */
export type BillingStatus = 'free' | 'held' | 'settled' | 'refunded' | 'failed';

/** R178 G28: Immutable audit log entry */
export interface BillingAuditEntry {
  entryId: string;
  timestamp: number;
  sessionId: string;
  userId: string;
  touchpoint: BillingTouchpoint;
  action: 'FREE_USE' | 'CHARGE_HELD' | 'CHARGE_SETTLED' | 'CHARGE_REFUNDED' | 'HOLD_TIMEOUT' | 'FORCE_REFUND';
  amountUSDT: number;
  txId?: string;
  reason?: string;
}

/** Touchpoint configuration */
export interface TouchpointConfig {
  touchpoint: BillingTouchpoint;
  label: string;               // Chinese display name
  costUSDT: number;            // Cost per use
  freeUses: number;            // Number of free uses per user
  freePreviewDays: number;     // Number of days user can preview without charge (0 = no preview)
  refundWindowHours: number;   // Refund window (hours, 0 = no refund)
  previewContent: string;      // What the user sees in preview
  lockMessage: string;         // Message shown when locked
}

/** Active billing session */
export interface BillingSession {
  sessionId: string;
  userId: string;
  touchpoint: BillingTouchpoint;
  status: BillingStatus;
  amountUSDT: number;
  heldAt: number;
  settledAt?: number;
  refundedAt?: number;
  transactionId?: string;
  usageCount: number;           // Total uses by this user for this touchpoint
  freeUsesLeft: number;         // Remaining free uses
}

/** Billing attempt result */
export interface BillingResult {
  ok: boolean;
  session: BillingSession;
  charged: boolean;
  amountCharged: number;
  freeUsesLeft: number;
  message: string;
}

// ── Touchpoint Configuration ────────────────────────────────────────────────

export const TOUCHPOINT_CONFIGS: Record<BillingTouchpoint, TouchpointConfig> = {
  AI_RECOMMENDATION: {
    touchpoint: 'AI_RECOMMENDATION',
    label: 'AI因子推荐',
    costUSDT: 1.0,
    freeUses: 3,
    freePreviewDays: 0,
    refundWindowHours: 1,
    previewContent: '基于实时IC/IR动态计算的因子推荐',
    lockMessage: '免费次数已用完，需付费1 USDT获取推荐',
  },
  BACKTEST_REPORT: {
    touchpoint: 'BACKTEST_REPORT',
    label: '回测报告',
    costUSDT: 2.0,
    freeUses: 3,
    freePreviewDays: 1,
    refundWindowHours: 0,
    previewContent: '30天摘要回测数据预览',
    lockMessage: '完整回测报告需2 USDT，预览仅含30天数据',
  },
  SIGNAL_SUBSCRIBE: {
    touchpoint: 'SIGNAL_SUBSCRIBE',
    label: '信号订阅',
    costUSDT: 0.5,
    freeUses: 5,
    freePreviewDays: 3,
    refundWindowHours: 24,
    previewContent: '信号标题+因子名称预览',
    lockMessage: '信号详情+策略建议需0.5 USDT/条',
  },
  STRATEGY_MARKET: {
    touchpoint: 'STRATEGY_MARKET',
    label: '策略市场',
    costUSDT: 9.9,
    freeUses: 0,
    freePreviewDays: 3,
    refundWindowHours: 48,
    previewContent: '策略摘要+因子列表+回测概要预览',
    lockMessage: '完整策略需9.9 USDT定价，含因子权重/信号/回测',
  },
  PAPER_TRADING: {
    touchpoint: 'PAPER_TRADING',
    label: '模拟交易',
    costUSDT: 1.0,
    freeUses: 5,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: '模拟交易引擎需1 USDT/次',
  },
  PORTFOLIO_DIAGNOSIS: {
    touchpoint: 'PORTFOLIO_DIAGNOSIS',
    label: '组合诊断',
    costUSDT: 3.0,
    freeUses: 1,
    freePreviewDays: 1,
    refundWindowHours: 0,
    previewContent: '风险摘要+暴露概要预览',
    lockMessage: '完整诊断报告需3 USDT',
  },
  COMPARISON_ANALYSIS: {
    touchpoint: 'COMPARISON_ANALYSIS',
    label: '对比分析',
    costUSDT: 2.0,
    freeUses: 2,
    freePreviewDays: 1,
    refundWindowHours: 0,
    previewContent: '首策略概要预览',
    lockMessage: '完整对比分析需2 USDT',
  },
  WEIGHT_OPTIMIZER: {
    touchpoint: 'WEIGHT_OPTIMIZER',
    label: '权重优化',
    costUSDT: 1.5,
    freeUses: 3,
    freePreviewDays: 0,
    refundWindowHours: 1,
    previewContent: '',
    lockMessage: '权重优化引擎需1.5 USDT',
  },
  SNAPSHOT_RESTORE: {
    touchpoint: 'SNAPSHOT_RESTORE',
    label: '快照恢复',
    costUSDT: 0.5,
    freeUses: 10,
    freePreviewDays: 0,
    refundWindowHours: 48,
    previewContent: '',
    lockMessage: '历史快照恢复需0.5 USDT',
  },
  DEEP_RESEARCH: {
    touchpoint: 'DEEP_RESEARCH',
    label: '深度研究',
    costUSDT: 5.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: '深度因子研究报告需5 USDT',
  },
  FACTOR_EXPERIMENT: {
    touchpoint: 'FACTOR_EXPERIMENT',
    label: '因子实验',
    costUSDT: 1.0,
    freeUses: 3,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: '因子实验需1 USDT/次',
  },
  // ── v17.7: Factor Deep Services (#25-28) ─────────────────────────
  FACTOR_MULTI_BACKTEST: {
    touchpoint: 'FACTOR_MULTI_BACKTEST',
    label: '多因子组合回测',
    costUSDT: 1.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: '多因子组合回测需1 USDT/次（单因子回测免费）',
  },
  FACTOR_DEEP_DIAGNOSIS: {
    touchpoint: 'FACTOR_DEEP_DIAGNOSIS',
    label: '因子深度诊断',
    costUSDT: 1.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: '因子深度诊断需1 USDT/次（基础信号灯免费）',
  },
  FACTOR_PARAM_OPTIMIZE: {
    touchpoint: 'FACTOR_PARAM_OPTIMIZE',
    label: 'AI因子参数优化',
    costUSDT: 1.5,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI因子参数优化需1.5 USDT/次（手动调参免费）',
  },
  FACTOR_ALT_DATA_UNLOCK: {
    touchpoint: 'FACTOR_ALT_DATA_UNLOCK',
    label: '替代数据因子解锁',
    costUSDT: 2.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: '替代数据因子解锁需2 USDT/次（浏览免费）',
  },
  // ── v17.8: AI Revenue Expansion (#29-35) ─────────────────────────
  AI_STRATEGY_MATCH: {
    touchpoint: 'AI_STRATEGY_MATCH',
    label: 'AI策略匹配推荐',
    costUSDT: 1.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI策略匹配推荐需1 USDT/次',
  },
  AI_MARKET_STATE: {
    touchpoint: 'AI_MARKET_STATE',
    label: 'AI市场状态识别',
    costUSDT: 1.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI市场状态识别需1 USDT/次',
  },
  AI_DAILY_BRIEFING: {
    touchpoint: 'AI_DAILY_BRIEFING',
    label: 'AI每日因子简报',
    costUSDT: 1.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI每日因子简报需1 USDT/次',
  },
  AI_ARBITRAGE_SCAN: {
    touchpoint: 'AI_ARBITRAGE_SCAN',
    label: 'AI跨市场套利扫描',
    costUSDT: 2.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI跨市场套利扫描需2 USDT/次',
  },
  AI_FACTOR_SIGNAL_PUSH: {
    touchpoint: 'AI_FACTOR_SIGNAL_PUSH',
    label: 'AI因子信号推送',
    costUSDT: 0.5,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI因子信号推送需0.5 USDT/条',
  },
  AI_STRESS_TEST: {
    touchpoint: 'AI_STRESS_TEST',
    label: 'AI策略压力测试',
    costUSDT: 2.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI策略压力测试需2 USDT/次',
  },
  AI_PORTFOLIO_ATTRIBUTION: {
    touchpoint: 'AI_PORTFOLIO_ATTRIBUTION',
    label: 'AI持仓归因分析',
    costUSDT: 1.5,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI持仓归因分析需1.5 USDT/次',
  },
  // ── v17.9: AI Creator Review (#36) — 1U/次, 不退费, 无申诉 ──
  AI_CREATOR_REVIEW: {
    touchpoint: 'AI_CREATOR_REVIEW',
    label: 'AI创作者策略审核',
    costUSDT: 1.0,
    freeUses: 0,
    freePreviewDays: 0,
    refundWindowHours: 0,
    previewContent: '',
    lockMessage: 'AI策略审核需1 USDT/次（不退费，给修改建议，每次1U，无限次）',
  },
};

// ── Factor Billing Gateway ──────────────────────────────────────────────────

export class FactorBillingGateway extends EventEmitter {
  private sessions: Map<string, BillingSession> = new Map();
  /** usageCount by userId:touchpoint */
  private usageCounts: Map<string, number> = new Map();
  private chargeCallback: ((userId: string, amount: number, touchpoint: BillingTouchpoint, sessionId: string) => Promise<{ ok: boolean; txId?: string }>) | null = null;

  // ── R178 G28: Immutable audit log ───────────────────────────────────

  private auditLog: BillingAuditEntry[] = [];
  private static readonly MAX_AUDIT_ENTRIES = 10000;
  private static readonly HOLD_TIMEOUT_MS = 3600000; // 1 hour auto-refund

  static readonly EVENTS = {
    SESSION_CREATED: 'billing:sessionCreated',
    CHARGE_HELD: 'billing:chargeHeld',
    CHARGE_SETTLED: 'billing:chargeSettled',
    CHARGE_REFUNDED: 'billing:chargeRefunded',
    FREE_USE: 'billing:freeUse',
  } as const;

  /** Set the billing handler (connects to wallet/charge system) */
  setChargeHandler(handler: (userId: string, amount: number, touchpoint: BillingTouchpoint, sessionId: string) => Promise<{ ok: boolean; txId?: string }>): void {
    this.chargeCallback = handler;
  }

  /**
   * Attempt to access a billing touchpoint.
   * Returns:
   *   - ok: whether access is granted
   *   - charged: whether a charge was processed
   *   - freeUsesLeft: remaining free uses after this attempt
   */
  async attemptAccess(userId: string, touchpoint: BillingTouchpoint): Promise<BillingResult> {
    const config = TOUCHPOINT_CONFIGS[touchpoint];
    const sessionId = `bill-${touchpoint}-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Check free uses
    const usageKey = `${userId}:${touchpoint}`;
    const currentUsage = this.usageCounts.get(usageKey) || 0;
    const freeUsesLeft = Math.max(0, config.freeUses - currentUsage);

    const session: BillingSession = {
      sessionId, userId, touchpoint, status: 'free',
      amountUSDT: config.costUSDT,
      heldAt: Date.now(),
      usageCount: currentUsage + 1,
      freeUsesLeft: freeUsesLeft > 0 ? freeUsesLeft - 1 : 0,
    };

    if (freeUsesLeft > 0) {
      // Free use
      this.usageCounts.set(usageKey, currentUsage + 1);
      session.status = 'free';
      this.sessions.set(sessionId, session);
      this.writeAudit({ sessionId, userId, touchpoint, action: 'FREE_USE', amountUSDT: 0 });
      this.emit(FactorBillingGateway.EVENTS.FREE_USE, session);
      log.info(`[BillingGateway] ${touchpoint}: free use #${currentUsage + 1}/${config.freeUses} for ${userId}`);
      return {
        ok: true, session, charged: false, amountCharged: 0,
        freeUsesLeft: freeUsesLeft - 1,
        message: `免费使用 (${currentUsage + 1}/${config.freeUses})`,
      };
    }

    // Must charge
    if (!this.chargeCallback) {
      // No billing handler = dev mode, auto-approve
      this.usageCounts.set(usageKey, currentUsage + 1);
      session.status = 'settled';
      session.settledAt = Date.now();
      this.sessions.set(sessionId, session);
      return {
        ok: true, session, charged: true, amountCharged: config.costUSDT,
        freeUsesLeft: 0,
        message: `开发模式自动扣费 ${config.costUSDT} USDT`,
      };
    }

    // Hold charge
    session.status = 'held';
    this.sessions.set(sessionId, session);
    this.writeAudit({ sessionId, userId, touchpoint, action: 'CHARGE_HELD', amountUSDT: config.costUSDT });
    this.emit(FactorBillingGateway.EVENTS.CHARGE_HELD, session);

    try {
      const result = await this.chargeCallback(userId, config.costUSDT, touchpoint, sessionId);
      if (result.ok) {
        this.usageCounts.set(usageKey, currentUsage + 1);
        session.status = 'settled';
        session.settledAt = Date.now();
        session.transactionId = result.txId;
        this.writeAudit({ sessionId, userId, touchpoint, action: 'CHARGE_SETTLED', amountUSDT: config.costUSDT, txId: result.txId });
        this.emit(FactorBillingGateway.EVENTS.CHARGE_SETTLED, session);
        return {
          ok: true, session, charged: true, amountCharged: config.costUSDT,
          freeUsesLeft: 0,
          message: `扣费成功 ${config.costUSDT} USDT`,
        };
      } else {
        session.status = 'failed';
        this.writeAudit({ sessionId, userId, touchpoint, action: 'CHARGE_REFUNDED', amountUSDT: config.costUSDT, reason: '充值回调返回失败' });
        return {
          ok: false, session, charged: false, amountCharged: 0,
          freeUsesLeft: 0,
          message: '扣费失败，请检查余额或稍后重试',
        };
      }
    } catch (e) {
      session.status = 'failed';
      this.writeAudit({ sessionId, userId, touchpoint, action: 'CHARGE_REFUNDED', amountUSDT: config.costUSDT, reason: `异常: ${(e as Error).message}` });
      return {
        ok: false, session, charged: false, amountCharged: 0,
        freeUsesLeft: 0,
        message: `扣费异常: ${(e as Error).message}`,
      };
    }
  }

  /**
   * Settle a held charge (confirm the service was delivered).
   */
  async settle(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'held') return false;
    session.status = 'settled';
    session.settledAt = Date.now();
    this.writeAudit({ sessionId, userId: session.userId, touchpoint: session.touchpoint, action: 'CHARGE_SETTLED', amountUSDT: session.amountUSDT, txId: session.transactionId });
    this.emit(FactorBillingGateway.EVENTS.CHARGE_SETTLED, session);
    return true;
  }

  /**
   * Refund a session within its refund window.
   */
  async refund(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const config = TOUCHPOINT_CONFIGS[session.touchpoint];
    const hoursSinceHeld = (Date.now() - session.heldAt) / (3600 * 1000);

    if (config.refundWindowHours > 0 && hoursSinceHeld <= config.refundWindowHours) {
      session.status = 'refunded';
      session.refundedAt = Date.now();
      this.writeAudit({ sessionId: session.sessionId, userId: session.userId, touchpoint: session.touchpoint, action: 'CHARGE_REFUNDED', amountUSDT: session.amountUSDT, reason: `用户退款(${hoursSinceHeld.toFixed(1)}h/${config.refundWindowHours}h窗口内)` });
      this.emit(FactorBillingGateway.EVENTS.CHARGE_REFUNDED, session);
      log.info(`[BillingGateway] Refunded ${session.sessionId} (${hoursSinceHeld.toFixed(1)}h)`);
      return true;
    }

    log.warn(`[BillingGateway] Refund denied: ${hoursSinceHeld.toFixed(1)}h > ${config.refundWindowHours}h window`);
    return false;
  }

  /**
   * Get usage count for a user+touchpoint.
   */
  getUsage(userId: string, touchpoint: BillingTouchpoint): number {
    return this.usageCounts.get(`${userId}:${touchpoint}`) || 0;
  }

  /**
   * Get remaining free uses.
   */
  getFreeUsesLeft(userId: string, touchpoint: BillingTouchpoint): number {
    const config = TOUCHPOINT_CONFIGS[touchpoint];
    return Math.max(0, config.freeUses - this.getUsage(userId, touchpoint));
  }

  /**
   * Get all billing configs for UI display.
   */
  getTouchpointConfigs(): TouchpointConfig[] {
    return Object.values(TOUCHPOINT_CONFIGS);
  }

  /**
   * Check if a user can preview a touchpoint.
   */
  canPreview(userId: string, touchpoint: BillingTouchpoint): boolean {
    const config = TOUCHPOINT_CONFIGS[touchpoint];
    return config.freePreviewDays > 0 && this.getUsage(userId, touchpoint) === 0;
  }

  // ── R178 G28: Immutable Audit Log ───────────────────────────────────

  private writeAudit(entry: Omit<BillingAuditEntry, 'entryId' | 'timestamp'>): void {
    const auditEntry: BillingAuditEntry = {
      ...entry,
      entryId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    Object.freeze(auditEntry);
    this.auditLog.push(auditEntry);

    // Trim oldest entries if exceeding max
    if (this.auditLog.length > FactorBillingGateway.MAX_AUDIT_ENTRIES) {
      this.auditLog = this.auditLog.slice(-FactorBillingGateway.MAX_AUDIT_ENTRIES);
    }

    log.info(`[BillingAudit] ${entry.action} ${entry.touchpoint} ${entry.amountUSDT}USDT session=${entry.sessionId.slice(0,20)}`);
  }

  /** Get immutable audit log (read-only copy). */
  getAuditLog(filters?: { userId?: string; touchpoint?: BillingTouchpoint; since?: number; action?: string }): ReadonlyArray<BillingAuditEntry> {
    let entries = [...this.auditLog];
    if (filters) {
      if (filters.userId) entries = entries.filter(e => e.userId === filters.userId);
      if (filters.touchpoint) entries = entries.filter(e => e.touchpoint === filters.touchpoint);
      if (filters.since) entries = entries.filter(e => e.timestamp >= filters.since);
      if (filters.action) entries = entries.filter(e => e.action === filters.action);
    }
    return entries;
  }

  /**
   * Check and auto-refund expired holds (>1 hour).
   * Returns array of sessions that were auto-refunded.
   */
  checkExpiredHolds(): BillingSession[] {
    const now = Date.now();
    const expired: BillingSession[] = [];

    for (const [id, session] of this.sessions) {
      if (session.status === 'held' && now - session.heldAt > FactorBillingGateway.HOLD_TIMEOUT_MS) {
        session.status = 'refunded';
        session.refundedAt = now;
        this.writeAudit({
          sessionId: session.sessionId, userId: session.userId,
          touchpoint: session.touchpoint, action: 'HOLD_TIMEOUT',
          amountUSDT: session.amountUSDT,
          reason: `Hold超时(${Math.round((now - session.heldAt) / 60000)}分钟)自动退款`,
        });
        this.emit(FactorBillingGateway.EVENTS.CHARGE_REFUNDED, session);
        expired.push(session);
        log.warn(`[BillingGateway] Auto-refund expired hold: ${id} held for ${Math.round((now - session.heldAt) / 60000)}min`);
      }
    }

    return expired;
  }

  /** Force-refund a held session (admin override). */
  forceRefund(sessionId: string, reason: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'held') return false;
    session.status = 'refunded';
    session.refundedAt = Date.now();
    this.writeAudit({
      sessionId: session.sessionId, userId: session.userId,
      touchpoint: session.touchpoint, action: 'FORCE_REFUND',
      amountUSDT: session.amountUSDT, reason,
    });
    this.emit(FactorBillingGateway.EVENTS.CHARGE_REFUNDED, session);
    log.info(`[BillingGateway] Force refund: ${sessionId} reason=${reason}`);
    return true;
  }

  getAuditStats(): { totalEntries: number; totalHeld: number; totalSettled: number; totalRefunded: number } {
    const stats = { totalEntries: this.auditLog.length, totalHeld: 0, totalSettled: 0, totalRefunded: 0 };
    for (const e of this.auditLog) {
      if (e.action === 'CHARGE_HELD') stats.totalHeld++;
      else if (e.action === 'CHARGE_SETTLED') stats.totalSettled++;
      else if (e.action === 'CHARGE_REFUNDED' || e.action === 'HOLD_TIMEOUT' || e.action === 'FORCE_REFUND') stats.totalRefunded++;
    }
    return stats;
  }

  reset(): void {
    this.sessions.clear();
    this.usageCounts.clear();
    this.auditLog = [];
    this.removeAllListeners();
    log.info('[BillingGateway] Reset');
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _gateway: FactorBillingGateway | null = null;

export function getFactorBillingGateway(): FactorBillingGateway {
  if (!_gateway) _gateway = new FactorBillingGateway();
  return _gateway;
}

export function resetFactorBillingGateway(): void {
  _gateway?.reset();
  _gateway = null;
}
