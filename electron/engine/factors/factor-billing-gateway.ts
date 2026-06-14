// ── R174 D1: Unified Factor Billing Gateway ──────────────────────────────────
// 11 payment touchpoints, unified hold→settle→refund billing flow.
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
//
// Each point: hold 1 USDT → compute → settle on success → refund on failure.
// Free tier: first 3 uses free, preview for 3 days, top 3 factors preview.
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
  | 'FACTOR_EXPERIMENT';

/** Billing status for a single touchpoint usage */
export type BillingStatus = 'free' | 'held' | 'settled' | 'refunded' | 'failed';

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
};

// ── Factor Billing Gateway ──────────────────────────────────────────────────

export class FactorBillingGateway extends EventEmitter {
  private sessions: Map<string, BillingSession> = new Map();
  /** usageCount by userId:touchpoint */
  private usageCounts: Map<string, number> = new Map();
  private chargeCallback: ((userId: string, amount: number, touchpoint: BillingTouchpoint, sessionId: string) => Promise<{ ok: boolean; txId?: string }>) | null = null;

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
    this.emit(FactorBillingGateway.EVENTS.CHARGE_HELD, session);

    try {
      const result = await this.chargeCallback(userId, config.costUSDT, touchpoint, sessionId);
      if (result.ok) {
        this.usageCounts.set(usageKey, currentUsage + 1);
        session.status = 'settled';
        session.settledAt = Date.now();
        session.transactionId = result.txId;
        this.emit(FactorBillingGateway.EVENTS.CHARGE_SETTLED, session);
        return {
          ok: true, session, charged: true, amountCharged: config.costUSDT,
          freeUsesLeft: 0,
          message: `扣费成功 ${config.costUSDT} USDT`,
        };
      } else {
        session.status = 'failed';
        return {
          ok: false, session, charged: false, amountCharged: 0,
          freeUsesLeft: 0,
          message: '扣费失败，请检查余额或稍后重试',
        };
      }
    } catch (e) {
      session.status = 'failed';
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

  reset(): void {
    this.sessions.clear();
    this.usageCounts.clear();
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
